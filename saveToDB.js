import puppeteer from 'puppeteer';
// Or import puppeteer from 'puppeteer-core';

export async function saveToDB(numberPhone, curso) {
    console.log(numberPhone, curso)
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({
        headless: true, // Para que se vea el navegador
        defaultViewport: null, // Para que use el tamaño real
        args: ['--start-maximized'], // Maximiza la ventana
        slowMo: 1
    });
    const page = await browser.newPage();

    // iniciar sesion
    await page.goto('https://master.escuelaesme.com/login');
    await page.waitForSelector('#email')
    await page.type('#email', 'asesorescuelaesme7@gmail.com')
    await page.type('#password', 'Esme2024**11')
    await page.click('body > app-root > div > app-login > div > div > div.card-body.ng-star-inserted > div > p-button > button') //boton de acceder
   
    // ir a clientes
    await page.waitForSelector('body > app-root > app-sidebar-nav > p-sidebar > div > div.menu.ng-star-inserted > p-button:nth-child(4) > button > span', { timeout: 240000 })
    await page.click('body > app-root > app-sidebar-nav > p-sidebar > div > div.menu.ng-star-inserted > p-button:nth-child(4) > button > span') //boton de clientes

    await page.waitForSelector('.title-manager', { timeout: 240000 })
    await page.waitForSelector('input[placeholder="Filtrar por celular"]', { timeout: 240000 })
    await page.type('input[placeholder="Filtrar por celular"]', numberPhone)// insertar nuevo registro

    await page.waitForSelector('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span')//boton buscar
    await page.click('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span')

    await page.waitForSelector('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span', { timeout: 240000 })
    let tbody = await page.$('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span')

    if (tbody) {
        // agrega observacion
        await page.waitForSelector('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span') //boton de info
        await page.click('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span')

        //boton de añadir
        await page.waitForSelector('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-4.ng-star-inserted > div > div > div.ng-tns-c2247072372-4.p-dialog-content.ng-star-inserted > div > p-button > button')
        await page.click('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-4.ng-star-inserted > div > div > div.ng-tns-c2247072372-4.p-dialog-content.ng-star-inserted > div > p-button > button')

        // 1. Obtener todos los textarea
        await page.waitForSelector('textarea')
        const textareas = await page.$$('textarea');

        // 2. Seleccionar el último
        const ultimoTextarea = textareas[textareas.length - 1];

        // 3. Escribir en el textarea
        await ultimoTextarea.type(`Informacion de ${curso}`)

        //click tres puntos
        const observaciones = await page.$$('.input-observation');
        const ultimaObs = observaciones[observaciones.length - 1];

        const iconoTresPuntos = await ultimaObs.$('i.pi.pi-ellipsis-h');

        if (iconoTresPuntos) {
            await iconoTresPuntos.click();
            await page.waitForSelector('.p-contextmenu ul li', { visible: true });

            const items = await page.$$('.p-contextmenu ul li');
            await items[0].click(); // primer item = Guardar
        }
        console.log('observacion para contacto ya guardada creada')
        browser.close()
        return true

    } else {
        //guardar nuevo contacto
        await page.waitForSelector('#pn_id_2-table > thead > tr:nth-child(1) > th:nth-child(2) > p-button > button')// boton nuevo
        await page.click('#pn_id_2-table > thead > tr:nth-child(1) > th:nth-child(2) > p-button > button')

        await page.waitForSelector('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-3.ng-star-inserted > div > div > div.ng-tns-c2247072372-3.p-dialog-content.ng-star-inserted > form > span > input')
        await page.type('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-3.ng-star-inserted > div > div > div.ng-tns-c2247072372-3.p-dialog-content.ng-star-inserted > form > span > input', numberPhone)

        await page.type('#pn_id_7 > span', 'asesorado')
        await page.keyboard.press('Enter');

        await page.type('#pn_id_9 > span', curso)
        await page.keyboard.press('Enter');

        await page.type('#pn_id_11 > span', 'Abb')
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        await page.waitForSelector('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span')//boton buscar
        await page.click('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span')
        
        console.log('nuevo contacto creado')
        browser.close()
        return true
    }

}





