const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function searchGogoanime(animeTitle, episodeNumber) {
    try {
        console.log(`Searching for: ${animeTitle} Episode ${episodeNumber}`);

        // Step 1: Format search query for Gogoanime
        const searchUrl = `https://ww24.gogoanimes.fi/search.html?keyword=${encodeURIComponent(animeTitle)}`;
        const searchResponse = await axios.get(searchUrl);
        const $ = cheerio.load(searchResponse.data);

        // Step 2: Find the first search result link
        const firstResult = $('.items li a').first();
        const animeSlug = firstResult.attr('href')?.split('/')[2]; // Extract slug from URL

        if (!animeSlug) {
            console.log("Anime not found.");
            return;
        }

        console.log(`Anime Found: ${animeSlug}`);

        // Step 3: Get the episode page URL
        const episodeUrl = `https://ww24.gogoanimes.fi/${animeSlug}-episode-${episodeNumber}`;
        console.log(`Episode URL: ${episodeUrl}`);

        // Step 4: Get the S3embtaku Download Page
        await getDownloadPage(episodeUrl, animeTitle, episodeNumber);
    } catch (error) {
        console.error("Error searching Gogoanime:", error.message);
    }
}

async function getDownloadPage(episodeUrl, animeTitle, episodeNumber) {
    try {
        console.log(`Fetching: ${episodeUrl}`);

        const response = await axios.get(episodeUrl);
        const $ = cheerio.load(response.data);

        // Step 1: Find the S3embtaku Download Link
        const downloadPageUrl = $('.dowloads a').attr('href');

        if (downloadPageUrl) {
            console.log(`S3embtaku Download Page Found: ${downloadPageUrl}`);

            // Step 2: Fetch the ggredi.info Download Link
            await getGgrediLink(downloadPageUrl, animeTitle, episodeNumber);
        } else {
            console.log("No download page link found.");
        }
    } catch (error) {
        console.error("Error fetching download page link:", error.message);
    }
}

async function getGgrediLink(downloadPageUrl, animeTitle, episodeNumber) {
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

        await browser.close();

        // Step 3: Follow Redirect to Get Final MP4 Video Link
        await getFinalMp4Link(ggrediLink, animeTitle, episodeNumber);
    } catch (error) {
        console.error("Error finding ggredi.info link:", error.message);
        await browser.close();
    }
}

async function getFinalMp4Link(redirectLink, animeTitle, episodeNumber) {
    try {
        console.log(`Following redirect: ${redirectLink}`);

        // Step 1: Follow Redirect and Get Final Video URL
        const response = await axios.get(redirectLink, { maxRedirects: 5 });

        if (response.request.res.responseUrl) {
            const finalMp4Link = response.request.res.responseUrl;
            console.log(`Final MP4 Download Link: ${finalMp4Link}`);

            // Step 2: Save to File
            const line = `${animeTitle} Episode ${episodeNumber} (360p): ${finalMp4Link}\n`;
            fs.appendFileSync('download.txt', line, 'utf8');
        } else {
            console.log("No final MP4 link found.");
        }
    } catch (error) {
        console.error("Error fetching final MP4 link:", error.message);
    }
}

// Example Usage
searchGogoanime("Naruto Shippuden", 7);
searchGogoanime("Attack on Titan", 5);
searchGogoanime("One Piece", 1000);