const puppeteer = require("./node_modules/puppeteer");
const moment = require("./node_modules/moment");
const _ = require("./node_modules/lodash");
const baseURL = 'https://www.capitalcityonlineauction.com';
const homeURL = '/cgi-bin/mncal.cgi?ccoa';
const fullHomeURL = baseURL + homeURL;
const startTime = moment();
const searchTerms = process.argv.slice(2);
const searchLocations = ["DONN", "RIVERSIDE", "BLATT", "JACKSON", "JACKSON RD", "BLATT BLVD", "GREENPOINTE", "GREEN POINTE", "43017", "43235", "43085", "43229", "43231", "43230", "43224", "43214", "43220", "43221", "43202", "43211", "43219", "43201", "43212", "43213", "43203", "43215", "43209", "43204", "43222", "43206", "43227", "43228", "43223", "43232", "43207"]



function auctionTitleAndLinkScrape() {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                executablePath: "./node_modules/puppeteer/.local-chromium/win32-674921/chrome-win/chrome.exe"
            });
            const page = await browser.newPage();
            await page.goto(baseURL); //fullHomeURL
            await page.waitFor(5000);
            let urls = await page.evaluate(() => {
                let results = [];
                const links = Array.from(document.querySelectorAll('#wrapper font > a'));
                links.forEach((link) => {
                    results.push({
                        url: link.getAttribute('href'),
                        title: link.innerText,
                    });
                });
                return results

            })
            browser.close();
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }

    })
}
async function dataScrape() {
    let closeAuctions = [];
    let auctionObjects = await auctionTitleAndLinkScrape();

    for (let auctionObject = 0; auctionObject <= auctionObjects.length - 1; auctionObject++) {
        // console.log(`Processing object ${auctionObject + 1} out of ${auctionObjects.length}`)
        let holderObject = {};
        auctionObjects[auctionObject].title = auctionObjects[auctionObject].title.toUpperCase();
        //uppercase it just to make sure everything is consistent
        //auctionObjects[auctionObject].title = auctionObjects[auctionObject].title.slice(auctionObjects[auctionObject].title.indexOf('ENDING')) //nothing before the word ending is important to me
        for (let location of searchLocations) {
            if (auctionObjects[auctionObject].title.includes(location) & (!auctionObjects[auctionObject].title.includes("HAS ENDED"))) {
                console.log(location);
                holderObject['url'] = auctionObjects[auctionObject].url;
                holderObject['title'] = auctionObjects[auctionObject].title;
                closeAuctions.push(holderObject);
            } else {}
        }
    };
    return closeAuctions;


}
async function crawler() { //maybe before this func i can write a func to read a draft to get the recipient information and then the keywords that they want
    let auctions = await dataScrape();
    //"Home Decor", "computer Chair", "industrial", "shelf"

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: "./node_modules/puppeteer/.local-chromium/win32-674921/chrome-win/chrome.exe"
    });
    let html = []
    for (let auction = 0; auction < auctions.length; auction++) {
        await console.log(`working on auction ${auction + 1} of ${auctions.length}`);

        for (let i = 0; i < searchTerms.length; i++) {
            try {
                let page = await browser.newPage();
                await page.goto(baseURL + auctions[auction].url);
                await page.waitForSelector("#SearchArea > form:nth-child(1) > input[type=text]:nth-child(2)"); //sometimes it fails here. attempt retry logic?
                await page.type("#SearchArea > form:nth-child(1) > input[type=text]:nth-child(2)", searchTerms[i]);
                await page.click("#SearchArea > form:nth-child(1) > input[type=submit]:nth-child(4)");
                await page.waitFor(1000);
                let htmlContent = await page.content();


                let htmlObj = await {
                    "title": auctions[auction].title,
                    "content": htmlContent,
                    "searchTerm": searchTerms[i],
                    "auctionLink": baseURL + auctions[auction].url
                };
                await html.push(htmlObj);
                await console.log(`pushed ${searchTerms[i]} results to html array`);
                await page.close();
            } catch (e) {
                console.log(`Failed to push some search value from auction ${auction+1}DEBUG THIS AND GET IT TO PRING SEARCH VALUE AND TRIM UP FAILURE TIME`)
            }
        }

    }
    await browser.close()
    return html
}
async function filterContent() {
    let p = await crawler();
    let returnObj = [];
    for (let i = 0; i <= p.length - 1; i++) {

        if (await !p[i].content.includes("No data found.  Try another search.") || (await !p[i].content.includes("ended"))) {
            let temp = [];
            try {
                if (await p[i].content.includes("<tr class=\"DataRow\" id=\"")) {
                    temp = p[i].content.split("<tr class=\"DataRow\" id=\""); //one of these split functions dont work all the time
                } else {
                    temp = p[i].content.split('<tr class="Datarow');
                }
            } catch (e) {
                console.log(e);
                console.log("first if else statement")
            }
            temp.splice(0, 1);
            for (let j = 0; j <= temp.length - 1; j++) {

                try {
                    // if (temp[j].includes("/td>")) {
                    let lineItems = temp[j].split("</td>");

                    //console.log(lineItems)
                    // }
                    lineItems[1] = lineItems[1].split(`href="`);
                    lineItems[1] = lineItems[1][1].split(`"><img border="`);
                    lineItems[1].splice(1);
                    lineItems[1] = lineItems[1].toString();
                    lineItems[5] = lineItems[5].split(`<`);
                    lineItems[5] = lineItems[5][1].split(`td align="right">`);
                    lineItems[5].shift();
                    lineItems[5] = lineItems[5].toString();

                    if (lineItems[5] === "&nbsp;") {
                        lineItems[5] = "Current Amount Not Found";
                    };
                    let x = {
                        "link": 'https://www.capitalcityonlineauction.com' + lineItems[1],
                        "description": "", //lineItems[2],
                        "currentAmount": lineItems[5],
                        "searchTerm": p[i].searchTerm

                    };


                    returnObj.push(x);
                } catch (e) {
                    console.log(e);
                    console.log(temp[j]);
                    break;
                }
            }


        }





    }
    return returnObj;
}
async function localBrowsing() {
    let objects = await filterContent();

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        executablePath: "./node_modules/puppeteer/.local-chromium/win32-674921/chrome-win/chrome.exe"
    });
    console.log(objects.length + " total links before deduplicate");
    objects = _.uniqBy(objects, "link");
    console.log(objects.length + " total tabs to open");

    for (let i = 0; i < objects.length; i++) {
        let page = await browser.newPage();
        await page.goto(objects[i].link);
        console.log(`opening tab ${i + 1} out of ${objects.length}`);

    }
    let endTime = moment();
    console.log((endTime.diff(startTime, 'minutes')) + " total minutes to complete");
}
async function savetoJson() { // file system module to perform file operations
    const fs = require('fs');

    // json data
    let jsonData = await filterContent();
    // parse json
    let jsonVar = JSON.stringify(jsonData)
    // stringify JSON Object
    //let jsonObj = JSON.parse(jsonVar)
    fs.writeFile("output.json", jsonVar, 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
        let endTime = moment();
        console.log((endTime.diff(startTime, 'minutes')) + " total minutes to complete")
    });
}
localBrowsing();
//savetoJson();