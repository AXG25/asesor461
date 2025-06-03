const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cursos = require('./cursos.js');
const { MessageMedia } = require('whatsapp-web.js');

// Configuración del cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Constantes
const ASISTENTE_NUMERO = '573025479797@c.us';
const USERS_FILE = path.join(__dirname, 'users.json');
const CLEANUP_INTERVAL = 15 * 24 * 60 * 60 * 1000; // 15 días en milisegundos
const INACTIVE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
const FOLLOW_UP_TIMEOUT = 3 * 24 * 60 * 60 * 1000; // 3 días en milisegundos
const STOP_EMOJI = '✨'; // Emoji para detener interacción

// Estructura de datos para usuarios
let users = {};
let processedMessages = new Set(); // Para evitar procesar mensajes duplicados

// Cargar usuarios desde JSON
const loadUsers = () => {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            users = JSON.parse(data);
            console.log('Usuarios cargados correctamente.');
        }
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        users = {}; // Reiniciar usuarios si hay error
    }
};

// Guardar usuarios en JSON
const saveUsers = () => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error al guardar usuarios:', error);
    }
};

// Limpiar usuarios inactivos
const cleanupInactiveUsers = async () => {
    const now = Date.now();
    let count = 0;

    for (const [userId, user] of Object.entries(users)) {
        if (!user.finalizado && user.lastActivity) {
            const timeSinceLastActivity = now - user.lastActivity;
            
            // Si han pasado 3 días y no se ha enviado el mensaje de seguimiento
            if (timeSinceLastActivity > FOLLOW_UP_TIMEOUT && !user.followUpSent && user.estado === 'seleccion_fechas') {
                await sendMessage(userId, 'Hola, ¿lograste revisar la información que te mandé? ¿Tienes alguna duda? ¿Te interesa el curso?');
                user.followUpSent = true;
                user.lastActivity = now;
                count++;
            }
            // Si han pasado más de 24 horas desde la última actividad, limpiar el usuario
            else if (timeSinceLastActivity > INACTIVE_TIMEOUT) {
                delete users[userId];
                count++;
            }
        }
    }

    if (count > 0) {
        console.log(`Procesados ${count} usuarios inactivos.`);
        saveUsers();
    }
};

// Limpiar todos los usuarios periódicamente
const setupCleanup = () => {
    // Limpiar usuarios inactivos cada día
    setInterval(cleanupInactiveUsers, INACTIVE_TIMEOUT);

    // Limpiar todos los usuarios cada 15 días
    setInterval(() => {
        users = {};
        processedMessages.clear();
        saveUsers();
        console.log('Todos los usuarios limpiados.');
    }, CLEANUP_INTERVAL);
};

// Esperar un tiempo aleatorio para simular tipeo humano
const waitRandom = async () => {
    const delay = Math.floor(Math.random() * 3000) + 7000;
    return new Promise(resolve => setTimeout(resolve, delay));
};

// Normalizar texto para comparaciones
const normalizeText = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Mejor regex para acentos
        .toLowerCase()
        .trim();
};

// Verificar si un archivo existe
const fileExists = (filePath) => {
    try {
        const absolutePath = path.resolve(__dirname, filePath);
        return fs.existsSync(absolutePath);
    } catch (error) {
        console.error(`Error verificando existencia de archivo ${filePath}:`, error);
        return false;
    }
};

// Enviar mensaje con manejo de errores
const sendMessage = async (chatId, message, options = {}) => {
    try {
        await client.sendMessage(chatId, message, options);
        return true;
    } catch (error) {
        console.error(`Error al enviar mensaje a ${chatId}:`, error);
        return false;
    }
};

// Enviar media con manejo de errores
const sendMedia = async (chatId, mediaPath, caption = '') => {
    try {
        const absolutePath = path.resolve(__dirname, mediaPath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`Archivo no encontrado: ${absolutePath}`);
            return false;
        }

        const media = MessageMedia.fromFilePath(absolutePath);
        await client.sendMessage(chatId, media, { caption });
        return true;
    } catch (error) {
        console.error(`Error al enviar media a ${chatId}:`, error);
        return false;
    }
};

// Función específica para enviar archivos de audio con manejo de errores
const sendAudio = async (chatId, audioPath) => {
    try {
        const absolutePath = path.resolve(__dirname, audioPath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`Archivo de audio no encontrado: ${absolutePath}`);
            // Si el audio no existe, enviar un mensaje de texto como alternativa
            return false;
        }

        const audioMedia = MessageMedia.fromFilePath(absolutePath);
        await client.sendMessage(chatId, audioMedia, { sendAudioAsVoice: true });
        return true;
    } catch (error) {
        console.error(`Error al enviar audio a ${chatId}:`, error);
        // En caso de error, enviar un mensaje de texto alternativo
        return false;
    }
};

// Notificar al asistente y cerrar el flujo automático
const finalizarConversacionAutomatica = async (chatId, mensaje) => {
    try {
        await sendMessage(ASISTENTE_NUMERO, mensaje);

        // Marcar la conversación como finalizada para el bot
        if (!users[chatId]) users[chatId] = {};
        users[chatId].finalizado = true;
        users[chatId].lastActivity = Date.now();
        users[chatId].requiereAsesor = true;
        saveUsers();

        console.log(`Conversación automática finalizada con ${chatId}: ${mensaje}`);
    } catch (error) {
        console.error('Error al notificar al asistente:', error);
    }
};

// Manejar proceso de selección de fechas
const handleDateSelection = async (chatId, text, usuario) => {
    if (text.includes('si') || text.includes('ok') || text.includes('dale') || text.includes('siii') || text.includes('fechas') || text.includes('fecha') || text.includes('inicio') || text.includes('horario') || text.includes('horarios') || text.includes('bueno') || text.includes('bien') || text.includes('porfavor') || text.includes('gracias') || text.includes('favor') || text.includes('entre') || text.includes('entre semana') || text.includes('en semana') || text.includes('fines') || text.includes('fines de semana') || text.includes('fin')) {
        usuario.estado = 'seleccion_reserva';
        usuario.lastActivity = Date.now();
        usuario.respuestasInesperadas = 0; // Reiniciar contador de respuestas inesperadas
        await waitRandom();
        await sendMessage(chatId, cursos[usuario.curso].fechas);
        await waitRandom();
        await sendMessage(chatId, 'Voy a estar muy atento a cualquier duda o inquietud que tengas 😌');
        await waitRandom();
        await sendMessage(chatId, 'Te gustaria aprovechar la promocion? como te queda mas facil apartar el cupo. con una transferencia o pagando en efectivo?');
        saveUsers();
    }
};

// Manejar proceso de reserva
const handleReservationSelection = async (chatId, text, usuario) => {
    if (text.includes('transferencia') || text.includes('transfiero') || text.includes('consigno') || text.includes('transferir') || text.includes('cuenta') || text.includes('cuentas') || text.includes('consignacion') || text.includes('consignar') || text.includes('numero') || text.includes('nequi') || text.includes('neki') || text.includes('bancolombia')) {
        usuario.respuestasInesperadas = 0; // Reiniciar contador
        await waitRandom();
        await sendMessage(chatId, `Bueno primero debemos llenar este formulario para hacer la matricula el formulario te va a pedir un codigo de asesor. *Mi codigo de asesor es _Abi_*\n\n https://docs.google.com/forms/d/e/1FAIpQLSeCzIyb-5ASy_vFDo71WEoVh27GtfKfS5DuOZKRqGjEafALtQ/viewform?usp=sf_linkh`);
        await waitRandom();
        await sendMessage(chatId, `Y podemos hacer la consignación a una de nuestras cuentas\n\n1.💳 BANCOLOMBIA \nCuenta de ahorros: Claudia Bolívar \n00896502867\n\n2.📱Nequi \nClaudia Bolívar \n3117367087`);
    }
    else if (text.includes('presencial') || text.includes('sede') || text.includes('direccion') || text.includes('ubicacion') || text.includes('ubicados') || text.includes('ubicado') || text.includes('encuentra') || text.includes('encuentras') || text.includes('efectivo') || text.includes('acercarme') || text.includes('acercar') || text.includes('encuentras') || text.includes('encuentran')) {
        usuario.respuestasInesperadas = 0; // Reiniciar contador
        await waitRandom();
        await sendMessage(chatId, `Aca te dejo la ubicacion: \nhttps://g.co/kgs/cc6o1RU`);
        await waitRandom();
        await sendMessage(chatId, `Necesito que me digas que dia y a que hora puedes venir para poder agendarte la cita. Nosotros atendemos de 8 a 5, en caso de que ese dia no puedas venir agradeceria muchisimo que me lo informaras tambien`);
        await waitRandom();

        // Usar el nuevo metodo sendAudio con manejo de errores
        await sendAudio(chatId, './fidelidad.mp3');
    }
    else {
        // Incrementar contador de respuestas inesperadas
        usuario.respuestasInesperadas = (usuario.respuestasInesperadas || 0) + 1;

        // Simplemente guardar el estado y esperar la próxima respuesta
        saveUsers();
        return;
    }

    await waitRandom();
    await sendMessage(ASISTENTE_NUMERO, `✅ Cliente completó el flujo. Interesado en ${usuario.curso}: ${chatId}`);
    users[chatId].finalizado = true;
    users[chatId].lastActivity = Date.now();
    saveUsers();
};

// Manejar inicio de nueva conversación
const handleNewConversation = async (chatId, text) => {
    const cursoEncontrado = Object.keys(cursos).find(curso =>
        cursos[curso].palabrasClave.some(palabra =>
            text.includes(normalizeText(palabra))
        )
    );

    if (cursoEncontrado) {
        users[chatId] = {
            estado: 'inicio',
            curso: cursoEncontrado,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            respuestasInesperadas: 0,
            followUpSent: false // Agregar campo para rastrear si se envió el mensaje de seguimiento
        };
        saveUsers();

        // Usar el nuevo método sendAudio con manejo de errores
        await waitRandom();
        await sendAudio(chatId, 'bienvenida.mp3');
        await waitRandom();
        await sendMedia(chatId, cursos[cursoEncontrado].pensum, cursos[cursoEncontrado].promocion);
        await waitRandom();
        await sendAudio(chatId, cursos[cursoEncontrado].presentacion);
        await waitRandom();
        await sendMedia(chatId, 'ubicacion.jpg', "Estamos en el centro de Medellin\nCra 42 #49-34");
        await waitRandom();
        await sendMessage(chatId, 'Quieres conocer las fechas de inicio con sus respectivos horarios?');

        users[chatId].estado = 'seleccion_fechas';
        users[chatId].lastActivity = Date.now();
        saveUsers();
        return true;
    }
    return false;
};

// Verificar si un chat es un grupo
const isGroup = async (chatId) => {
    try {
        const chat = await client.getChatById(chatId);
        return chat.isGroup;
    } catch (error) {
        console.error(`Error al verificar si ${chatId} es un grupo:`, error);
        return false; // Por defecto, asumimos que no es un grupo en caso de error
    }
};

// Configurar eventos del cliente
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code generado. Escanea para iniciar sesión.');
});

client.on('authenticated', () => {
    console.log('Autenticación exitosa!');
});

client.on('auth_failure', (error) => {
    console.error('Error de autenticación:', error);
});

client.on('ready', () => {
    console.log('Bot listo y conectado!');
    loadUsers();
    setupCleanup();
});

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
});

// Procesar mensajes entrantes
client.on('message', async msg => {
    try {
        // Evitar procesar mensajes duplicados
        if (processedMessages.has(msg.id.id)) {
            return;
        }
        processedMessages.add(msg.id.id);

        // Limitar el tamaño del conjunto de mensajes procesados
        if (processedMessages.size > 1000) {
            const oldestMessages = Array.from(processedMessages).slice(0, 500);
            oldestMessages.forEach(id => processedMessages.delete(id));
        }

        const chatId = msg.from;
        const text = normalizeText(msg.body);

        // Verificar si el mensaje proviene de un grupo
        if (await isGroup(chatId)) {
            console.log(`Ignorando mensaje del grupo: ${chatId}`);
            return; // No procesar mensajes de grupos
        }

        // Ignorar mensajes vacíos o no textuales
        if (!text) return;

        // Si el usuario ya completó el proceso
        if (users[chatId]?.finalizado) {
            await sendMessage(ASISTENTE_NUMERO, `Cliente que ya completó el proceso vuelve a escribir: ${chatId}, mensaje: "${msg.body}"`);
            return;
        }

        // Si es un nuevo usuario o no está en proceso
        if (!users[chatId]) {
            const iniciado = await handleNewConversation(chatId, text);
            if (!iniciado) {
                // Ignorar mensajes que no contienen palabras clave
                return;
            }
        } else {
            // Continuar el proceso existente
            const usuario = users[chatId];
            usuario.lastActivity = Date.now(); // Actualizar última actividad

            if (usuario.estado === 'seleccion_fechas') {
                await handleDateSelection(chatId, text, usuario);
            }
            else if (usuario.estado === 'seleccion_reserva') {
                await handleReservationSelection(chatId, text, usuario);
            }
            else {
                // Estado desconocido, podría ser un error en nuestra lógica
                console.error(`Estado desconocido para usuario ${chatId}: ${usuario.estado}`);
                await finalizarConversacionAutomatica(chatId, `❓ Cliente con estado desconocido: ${chatId}, mensaje: "${msg.body}"`);
            }
        }
    } catch (error) {
        console.error('Error en el procesamiento del mensaje:', error);
    }
});

// Escuchar mensajes enviados por el bot
client.on('message_create', async msg => {
    try {
        // Solo procesar mensajes enviados por el bot, no por otros usuarios
        if (msg.fromMe) {
            const chatId = msg.to;
            const text = normalizeText(msg.body);

            const cursoEncontrado = Object.keys(cursos).find(curso =>
                cursos[curso].palabrasClave.some(palabra =>
                    text.includes(palabra)
                )
            );

            if (cursoEncontrado && text?.includes('🚀')) {
                // Si el usuario ya está en la base de datos, evitar reiniciar su flujo
                if (!users[chatId] || users[chatId].finalizado) {
                    users[chatId] = {
                        estado: 'inicio',
                        curso: cursoEncontrado,
                        createdAt: Date.now(),
                        lastActivity: Date.now(),
                        respuestasInesperadas: 0
                    };
                    saveUsers();

                    console.log(`Iniciando flujo automático para ${chatId} sobre el curso: ${cursoEncontrado}`);

                    await waitRandom();
                    await sendAudio(chatId, 'bienvenida.mp3');
                    await waitRandom();
                    await sendMedia(chatId, cursos[cursoEncontrado].pensum, cursos[cursoEncontrado].promocion);
                    await waitRandom();
                    await sendAudio(chatId, cursos[cursoEncontrado].presentacion);
                    await waitRandom();
                    await sendMedia(chatId, 'ubicacion.jpg', "Estamos en el centro de Medellín\nCra 42 #49-34");
                    await waitRandom();
                    await sendMessage(chatId, '¿Quieres conocer las fechas de inicio con sus respectivos horarios?');

                    users[chatId].estado = 'seleccion_fechas';
                    users[chatId].lastActivity = Date.now();
                    saveUsers();
                }
            }

            // Verificar si el mensaje contiene el emoji de parada o "well"
            if (msg.body.includes(STOP_EMOJI) || msg.body.toLowerCase() === 'well') {
                if (!users[chatId]) users[chatId] = {};
                users[chatId].finalizado = true; // Marcar como finalizada
                users[chatId].lastActivity = Date.now();
                users[chatId].handledManually = true;
                saveUsers();

                console.log(`Conversación detenida manualmente con ${chatId}`);
            }
        }
    } catch (error) {
        console.error('Error en message_create:', error);
    }
});

// Enviar información del usuario actual si el asesor lo solicita
client.on('message', async msg => {
    try {
        if (msg.from === ASISTENTE_NUMERO) {
            const text = normalizeText(msg.body);

            // Comando para ver información de un usuario
            if (text.startsWith('info ')) {
                const chatId = text.substring(5).trim();

                if (users[chatId]) {
                    const userInfo = JSON.stringify(users[chatId], null, 2);
                    await sendMessage(ASISTENTE_NUMERO, `Información del usuario ${chatId}:\n\`\`\`\n${userInfo}\n\`\`\``);
                } else {
                    await sendMessage(ASISTENTE_NUMERO, `No hay información para el usuario ${chatId}`);
                }
            }

            // Comando para listar usuarios activos
            if (text === 'usuarios activos') {
                const now = Date.now();
                const activeUsers = Object.entries(users)
                    .filter(([_, user]) => !user.finalizado && user.lastActivity && (now - user.lastActivity < INACTIVE_TIMEOUT))
                    .map(([id, user]) => `- ${id}: ${user.curso}, estado: ${user.estado}`)
                    .join('\n');

                if (activeUsers) {
                    await sendMessage(ASISTENTE_NUMERO, `Usuarios activos:\n${activeUsers}`);
                } else {
                    await sendMessage(ASISTENTE_NUMERO, 'No hay usuarios activos actualmente');
                }
            }

            // Comando para listar conversaciones detenidas por emoji
            if (text === 'detenidos por emoji') {
                const stoppedUsers = Object.entries(users)
                    .filter(([_, user]) => user.stoppedByEmoji)
                    .map(([id, user]) => `- ${id}: ${user.curso || 'Sin curso'}, detenido hace: ${Math.round((Date.now() - user.lastActivity) / 60000)} minutos`)
                    .join('\n');

                if (stoppedUsers) {
                    await sendMessage(ASISTENTE_NUMERO, `Conversaciones detenidas por emoji:\n${stoppedUsers}`);
                } else {
                    await sendMessage(ASISTENTE_NUMERO, 'No hay conversaciones detenidas por emoji actualmente');
                }
            }
        }
    } catch (error) {
        console.error('Error procesando comandos del asistente:', error);
    }
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rechazo no manejado en:', promise, 'razón:', reason);
});

// Iniciar el cliente
client.initialize().catch(error => {
    console.error('Error al inicializar el cliente:', error);
});

console.log('Iniciando el bot de WhatsApp...');