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
    await page.locator('#email').fill('asesorescuelaesme7@gmail.com')
    await page.locator('#password').fill('Esme2024**11')
    await page.locator('body > app-root > div > app-login > div > div > div.card-body.ng-star-inserted > div > p-button > button').click() //boton de acceder

    // ir a clientes
    await page.locator('body > app-root > app-sidebar-nav > p-sidebar > div > div.menu.ng-star-inserted > p-button:nth-child(4) > button > span').click() //boton de clientes

    await page.locator('input[placeholder="Filtrar por celular"]').fill(numberPhone)// insertar nuevo registro

    await page.locator('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span').click()//boton de buscar

    let tbody

    try {
        await page.locator('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span').wait()
        tbody = await page.$('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span')
    } catch (error) {
        tbody = null
    }
   
    if (tbody) {
        // agrega observacion
        await page.locator('#pn_id_2-table > tbody > tr > td:nth-child(6) > p-button > button > span').click() //boton de info

        //boton de añadir
        await page.locator('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-4.ng-star-inserted > div > div > div.ng-tns-c2247072372-4.p-dialog-content.ng-star-inserted > div > p-button > button').click()

        // 1. Obtener todos los textarea
        await page.locator('textarea').wait()
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
        console.log('observacion para contacto ya guardado creada')
        browser.close()
        return true

    } else {
        //guardar nuevo contacto
        await page.locator('#pn_id_2-table > thead > tr:nth-child(1) > th:nth-child(2) > p-button > button').click()// boton nuevo

        await page.locator('body > app-root > div > app-clients > div > p-dialog.p-element.ng-tns-c2247072372-3.ng-star-inserted > div > div > div.ng-tns-c2247072372-3.p-dialog-content.ng-star-inserted > form > span > input').fill(numberPhone)
        await page.keyboard.press('Enter');

        await page.type('#pn_id_7 > span', 'asesorado')
        await page.keyboard.press('Enter');

        await page.type('#pn_id_9 > span', curso)
        await page.keyboard.press('Enter');

        await page.type('#pn_id_11 > span', 'Abb')
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        await page.locator('#pn_id_2-table > thead > tr:nth-child(2) > th:nth-child(2) > div > p-button:nth-child(1) > button > span').click()

        console.log('nuevo contacto creado')
        browser.close()
        return true
    }

}





