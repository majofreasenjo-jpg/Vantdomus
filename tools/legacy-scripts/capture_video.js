const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

(async () => {
    try {
        console.log("Iniciando navegador headless para grabación...");
        const browser = await puppeteer.launch({ 
            defaultViewport: { width: 1500, height: 900 },
            headless: 'new'
        });
        
        const page = await browser.newPage();

        console.log("Abriendo dashboard interactivo (LeaderLines interactivos)...");
        const fileUrl = 'file:///' + 'C:/Users/casa/Downloads/Infografia_KPIS_Animada_Final.html'.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'load', timeout: 60000 });

        // Esperar un poco a que LeaderLine dibuje las líneas iniciales
        await new Promise(r => setTimeout(r, 2000));

        console.log("Iniciando grabador de pantalla...");
        const recorder = new PuppeteerScreenRecorder(page, {
            fps: 30,
            videoFrame: { width: 1500, height: 900 },
            videoBitrate: 2000,
        });

        const savePath = 'C:/Users/casa/Downloads/Presentacion_Auto_VantDomus.mp4';
        await recorder.start(savePath);
        console.log("Grabando evento de hover...");

        const ids = ['p_uti', 'p_sal', 'p_amb', 'p_com', 'p_per', 'p_aud'];

        for (const id of ids) {
            console.log(`Simulando Hover en: ${id}`);
            await page.hover(`#${id}`);
            await new Promise(r => setTimeout(r, 2000)); // Mantener el hover 2 segundos
            
            // Simular mover el mouse fuera
            await page.hover(`h1`); // hover al titulo para quitar focus del pilar
            await new Promise(r => setTimeout(r, 500)); // Esperar la transición de salida
        }

        // Dejar un paneo final de 1 segundo
        await new Promise(r => setTimeout(r, 1000));

        await recorder.stop();
        console.log(`Video guardado exitosamente en: ${savePath}`);

        await browser.close();
    } catch(e) {
        console.error("Error durante la grabación:", e);
        process.exit(1);
    }
})();
