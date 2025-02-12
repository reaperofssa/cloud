const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function getGgrediLink(downloadPageUrl, animeSlug, episodeNumber) {
    console.log(`Opening in Puppeteer: ${downloadPageUrl}`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(downloadPageUrl, { waitUntil: 'networkidle2' });

        // Step 1: Wait for JavaScript to load the ggredi.info link
        await page.waitForSelector('a[href*="ggredi.info/download.php"]', { timeout: 10000 });

        // Step 2: Extract the ggredi.info link
        const ggrediLink = await page.evaluate(() => {
            return document.querySelector('a[href*="ggredi.info/download.php"]').href;
        });

        console.log(`ggredi.info Link Found: ${ggrediLink}`);

        // Step 3: Save to File
        const line = `${animeSlug} Episode ${episodeNumber}: ${ggrediLink}\n`;
        fs.appendFileSync('download.txt', line, 'utf8');

        await browser.close();
    } catch (error) {
        console.error("Error finding ggredi.info link:", error.message);
        await browser.close();
    }
}

async function getDownloadPage(animeSlug, episodeNumber) {
    try {
        // Step 1: Fetch the Gogoanime Episode Page
        const episodeUrl = `https://ww24.gogoanimes.fi/${animeSlug}-episode-${episodeNumber}`;
        console.log(`Fetching: ${episodeUrl}`);

        const response = await axios.get(episodeUrl);
        const $ = cheerio.load(response.data);

        // Step 2: Find the S3embtaku Download Link
        const downloadPageUrl = $('.dowloads a').attr('href');

        if (downloadPageUrl) {
            console.log(`S3embtaku Download Page Found: ${downloadPageUrl}`);

            // Step 3: Fetch the ggredi.info Download Link
            await getGgrediLink(downloadPageUrl, animeSlug, episodeNumber);
        } else {
            console.log("No download page link found.");
        }
    } catch (error) {
        console.error("Error fetching download page link:", error.message);
    }
}

// Example Usage
getDownloadPage("citrus-dub", 6);
getDownloadPage("vividred-operation", 1);
getDownloadPage("naruto", 4);