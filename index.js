import puppeteer from 'puppeteer';
import Client from '@infosimples/node_two_captcha';
import firebase from './firebaseInit';
import fs from 'fs'
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import HtmlTableToJson from 'html-table-to-json';

const storage = getStorage()

// Declare your client
const client = new Client('c41a16e62a22835d699e613ce5beb246', {
    timeout: 60000,
    polling: 5000,
    throwErrors: false
});

async function getResultsByZipCode(zip) {

    const browser = await puppeteer.launch({
        headless: false,
        // slows down Puppeteer operations
        slowMo: 100,
        // open dev tools 
        devtools: false
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1920,
        height: 1200,
    });
    const link = 'https://www.nmlsconsumeraccess.org/';

    await page.goto(link);

    // wait for input field selector to render
    await page.waitForSelector('#searchText');
    await page.click('#searchText');

    await page.keyboard.type(zip);
    // press enter on your keyboard
    await page.keyboard.press('Enter');

    await page.waitForSelector('#ctl00_MainContent_cbxAgreeToTerms');

    await page.click("#ctl00_MainContent_cbxAgreeToTerms");

    await solveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")

    await traverseZipPage(page);

    // await page.close();

    return // bye

    const names = await page.$$(".name");
    // const page2 = await browser.newPage();
    // for(let i = 0; i < names.length; i++) {
    //     const name = names[i];
    //     const innerHTML = await (await name.getProperty('innerHTML')).jsonValue();
    //     const INDIVIDUAL_SEPERATOR = "/INDIVIDUAL/"
    //     if(innerHTML.includes(INDIVIDUAL_SEPERATOR)) {
    //         const idx = innerHTML.indexOf(INDIVIDUAL_SEPERATOR) + INDIVIDUAL_SEPERATOR.length
    //         const id = innerHTML.substring(idx, idx+7)

    //         await page2.evaluate((id) => window.subSearchUI.redirect(`/EntityDetails.aspx/INDIVIDUAL/${id}`),id)
    //         await page2.waitFor(2000);
    //         await page2.waitForSelector('#entityDetail');
    //         await page2.waitFor(2000);
    //         // await page2.goto(`/Home.aspx/SubSearch?searchText=${zip}`),"33009")
    //     }
    // }



    // await page.evaluate((id) => window.subSearchUI.redirect(`/EntityDetails.aspx/INDIVIDUAL/${id}`),1558195)
    // await page.waitForSelector('#entityDetail');
    // await page.goBack();



}

let currentPage = 1;
let maxNumberOfPages = 1

async function traverseZipPage(page) {
    await page.waitForSelector('#searchResultArea');
    const total = await page.evaluate(() => {
        return parseInt(document.querySelectorAll("#filterTotal")[0].innerText.trim())
    })

    maxNumberOfPages = (total/ 9)

    while(currentPage < maxNumberOfPages) {
        await traverseZipPageIndividual(page);
        return
        await page.waitForTimeout(1000)
        await goToPageNumber(page, currentPage + 1);
    }
}
 

async function traverseZipPageIndividual(page) {
    await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")
    
    await page.waitForTimeout(2000)
    let individuals = await page.$$(".individual");

    for (let i = 0; i < individuals.length; i++) {
        const individual = individuals[i];

        await individual.click();
        await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")

        await getIndividualPageData(page)
        return

        await goBackToSearchResults();
        await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")

        const currentPageSelectedNumber = await getCurrentPageSelectedNumber(page)
        if(currentPage != currentPageSelectedNumber) {
            await goToPageNumber(page, currentPage)
            await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")
            }
        
            individuals = await page.$$(".individual");
        }

}

async function getIndividualPageData(page) {
    // const name = await (await page.$(".individual").getProperty('innerText')).jsonValue();
    await page.waitForTimeout(2000)

    const tables = await page.$$("table");

    let _values = {}
    for(let i = 0; i < 6; i++) {
        if(i == 4) {
            continue
        }
        let values = {}
        const tds = await tables[i].$$("td")

        for(let j = 0 ; j < tds.length; j += 2) {
            let key = await (await tds[j].getProperty('innerText')).jsonValue();
            key = key.substring(0, key.length -1).trim();
            key = key.replaceAll(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            
            let value = await (await tds[j+1].getProperty('innerText')).jsonValue();
            value = value.replace(/(\r\n|\n|\r)/gm, "");
            if(value.includes(", ")) {
                value = value.split(", ")
            } else if(value === "None" || value == "No") {
                value = false
            }

            values[key] = value

        }
        _values = Object.assign({}, _values, values);
    }


    const employment = await (await tables[4].getProperty('outerHTML')).jsonValue()
    _values.employment =  HtmlTableToJson.parse(employment).results
    await tables[5].getProperty("innerHTML")

    console.log(_values)
    debugger;

}

async function goBackToSearchResults(page) {
    const backLink = await page.$(".back > a")
    await backLink.click()
}

async function traverseZipPageCompany(page) {
    await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")

    await page.waitForSelector(".company")
    let companies = await page.$$(".company");


    for (let i = 0; i < companies.length; i++) {
        await page.waitForTimeout(2000)
        const company = companies[i];

        await company.click();
        await page.waitForTimeout(2000)

        await checkAndSolveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")

        await goBackToSearchResults();
        await page.waitForTimeout(3000);

        companies = await page.$$(".company");
    }
}

async function hasNextPage(page) {
    return await page.evaluate(() => {
        var el = document.querySelectorAll('li[class^="next"]');

        return !el[0].classList.contains("nextOff")
    })
}



async function goToPageNumber(page, pageNumber) {
    await page.evaluate((pageNumber) => window.subSearchUI.pageSearch(pageNumber, true), pageNumber)
    currentPage = pageNumber
}

async function getCurrentPageSelectedNumber(page) {
    return await page.evaluate(() => {
        return parseInt(document.querySelectorAll("#pagingBottom > div > div > ul > li  > strong")[0].innerText.trim())
    })
}

async function navigateToCurrentPage(page) {
    let pageNumber = await page.evaluate(() => {
        return document.querySelectorAll("#pagingBottom > div > div > ul > li  > strong")[0].innerText
    })
    while(pageNumber <= currentPage) {
        console.log("currentpage", currentPage)
        console.log("pageNumber", pageNumber)

        const pageLink = await getPageLink(page, currentPage)
        if(pageLink) {
            const success = await goToPageNumber(page, currentPage)
            console.log("success", success)
        } else {
            const maxPage = await getMaxPage(page)
            const success = await goToPageNumber(page, maxPage)
            console.log("success", success)

            await page.waitForTimeout(2000);
            pageNumber = await page.evaluate(() => {
                return document.querySelectorAll("#pagingBottom > div > div > ul > li  > strong")[0].innerText
            })
            console.log("moving pages")
        }
    }

}


async function getPageLink(page, pageNumber) {
    const link = await page.evaluate((pn) => {
        const links = document.querySelectorAll("#pagingBottom > div > div > ul > li  > a")
        for(let link of links) {
            if(link.innerText.includes(`${pn}`)) {
                return true
            }
        }
        return false
    }, pageNumber)
    return link
}

async function getMaxPage(page) {
    return await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("#pagingBottom > div > div > ul > li  > a"))
        return Number(links[links.length - 2].innerText.substring(7))
    })
}

    // async function goToPage(page, pageNumber) {

    //     const pageLink = await getPageLink(page, pageNumber)
    //     if(!pageLink) {
    //         console.log("can't find the page!!!")
    //         return false;
    //     }

    //     await page.waitForTimeout(2000)

        
    //     console.log("pageLink", pageLink)
    //     await pageLink.click()

    //     return true

    // }
    async function checkAndSolveCaptcha(page, captchaImageID, captchaTextboxID) {
        await page.waitForTimeout(2000);
        const url = await page.url();
        if (url.includes("TuringTestPage")) {
            await solveCaptcha(page, "c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage", "ctl00_MainContent_txtTuringText")
            await page.waitForTimeout(2000);
        }
    }

    async function solveCaptcha(page, captchaImageID, captchaTextboxID) {
        await page.waitForSelector(`#${captchaImageID}`);

        const captcha = await page.$(`#${captchaImageID}`);

        const file = `random.png`;

        await captcha.screenshot({
            path: file,
        });

        const data = fs.readFileSync(file);

        const captchaRef = ref(storage, file)

        // 'file' comes from the Blob or File API
        await uploadBytes(captchaRef, data).catch(error => {
            console.log("error on uploading captcha", error)
        });

        const url = await getDownloadURL(captchaRef)

        const captchaResponse = await client.decode({
            url: url,
        }).then(function (response) {
            return response.text;
        }).catch(function (err) {
            throw err;
        });

        await page.waitForSelector(`#${captchaTextboxID}`);

        await page.click(`#${captchaTextboxID}`);

        await page.keyboard.type(captchaResponse);

        await page.keyboard.press('Enter');

    }

    // async function traverseIndivdual(page, individual) {

    //     await page.waitForSelector('#individual');

    //     const name = await page.evaluate(() => {
    //         const el = document.getElementsByClassName('[id^="nameArea_"]');
    //         return el[0].textContent;
    //     })

    //     console.log(name)

    //     // await page.goBack();

    // }

    // async function getTextContentByClass(page, className) {
    //     return await page.evaluate(() => {
    //         const el = document.getElementsByClassName(className);
    //         return el[0].textContent;
    //     })
    // }

    async function start() {
        const zip = "33009"
        await getResultsByZipCode(zip)
    }


    start();

    function today() {
        let ts = Date.now();
        let date_ob = new Date(ts);
        let date = date_ob.getDate();
        let month = date_ob.getMonth() + 1;
        let year = date_ob.getFullYear();

        // prints date & time in YYYY-MM-DD format
        return year + "-" + month + "-" + date;

    }

