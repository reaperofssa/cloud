const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = 3000;

// Enable CORS
const cors = require('cors');
app.use(cors());

app.get('/anime/:title/:episode', async (req, res) => {
    const animeTitle = req.params.title;
    const episodeNumber = req.params.episode;
    
    console.log(`Requested: ${animeTitle} Episode ${episodeNumber}`);
    
    try {
        const episodeData = await searchGogoanime(animeTitle, episodeNumber);
        res.json(episodeData);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch episode data", details: error.message });
    }
});

async function searchGogoanime(animeTitle, episodeNumber) {
    try {
        console.log(`Searching for: ${animeTitle} Episode ${episodeNumber}`);

        // Search Gogoanime
        const searchUrl = `https://ww24.gogoanimes.fi/search.html?keyword=${encodeURIComponent(animeTitle)}`;
        const searchResponse = await axios.get(searchUrl);
        const $ = cheerio.load(searchResponse.data);

        // Find first result
        const firstResult = $('.items li a').first();
        const animeSlug = firstResult.attr('href')?.split('/')[2]; 
        if (!animeSlug) throw new Error("Anime not found");

        console.log(`Anime Found: ${animeTitle} (${animeSlug})`);

        // Episode page URL
        const episodeUrl = `https://ww24.gogoanimes.fi/${animeSlug}-episode-${episodeNumber}`;
        console.log(`Episode URL: ${episodeUrl}`);

        return await getEpisodeInfo(episodeUrl, animeTitle, episodeNumber);
    } catch (error) {
        throw new Error("Error searching Gogoanime: " + error.message);
    }
}

async function getEpisodeInfo(episodeUrl, animeTitle, episodeNumber) {
    try {
        console.log(`Fetching: ${episodeUrl}`);
        const response = await axios.get(episodeUrl);
        const $ = cheerio.load(response.data);

        // Find download link page
        const downloadPageUrl = $('.dowloads a').attr('href');
        if (!downloadPageUrl) throw new Error("Download page not found");

        console.log(`Download Page Found: ${downloadPageUrl}`);

        const downloadLinks = await getVideoLinks(downloadPageUrl);

        return {
            anime: animeTitle,
            episode: episodeNumber,
            owner: "Reiker",
            downloads: downloadLinks
        };
    } catch (error) {
        throw new Error("Error fetching episode info: " + error.message);
    }
}

async function getVideoLinks(downloadPageUrl) {
    console.log(`Opening Puppeteer: ${downloadPageUrl}`);
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu"
        ],
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/google-chrome-stable"
    });

    const page = await browser.newPage();

    try {
        await page.goto(downloadPageUrl, { waitUntil: 'networkidle2' });

        await page.waitForSelector('a[href*="ggredi.info/download.php"]', { timeout: 10000 });

        const videoLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="ggredi.info/download.php"]')).map(link => ({
                quality: link.innerText.trim(),
                url: link.href
            }));
        });

        await browser.close();

        const directDownloadLinks = {};
        const promises = videoLinks
            .filter(link => link.quality.includes('360') || link.quality.includes('720'))
            .map(async link => {
                const finalLink = await getFinalMp4Link(link.url);
                if (finalLink) {
                    directDownloadLinks[link.quality.replace(/\D/g, '') + 'p'] = finalLink;
                }
            });

        await Promise.all(promises);

        return directDownloadLinks;
    } catch (error) {
        console.error("Error extracting video links:", error.message);
        await browser.close();
        return {
            "360p": "Not available",
            "720p": "Not available"
        };
    }
}

async function getFinalMp4Link(redirectLink) {
    try {
        console.log(`Following redirect: ${redirectLink}`);

        // Step 1: Follow Redirect and Get Final Video URL
        const response = await axios.get(redirectLink, {
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 302 // Allow 302 redirects
        });

        const finalUrl = response.request.res.responseUrl;
        if (finalUrl && finalUrl.includes(".mp4")) {
            console.log(`Final MP4 Link: ${finalUrl}`);
            return finalUrl;
        } else {
            console.log("No valid MP4 link found.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching final MP4 link:", error.message);
        return null;
    }
}

// Start API Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
