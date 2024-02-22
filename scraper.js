const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());

const rawData = fs.readFileSync('./data.json');
const jsonData = JSON.parse(rawData);
const productURLs = jsonData.map((item) => `https://www.showdowndisplays.com/Product/Select?Sku=${item.Item_Number}`);

const websiteURL = `https://www.showdowndisplays.com/`;
const email = 'shaugen@showdowndisplays.com';
const password = 'Zsedcftgbhujmk1!';

async function performLogin(page) {
  await page.goto(websiteURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cookieAcceptBtn');
  await page.click('#cookieAcceptBtn');
  await page.waitForSelector('button.header-GlobalAccountFlyout-flyout-link');
  await page.click('button.header-GlobalAccountFlyout-flyout-link');
  await page.waitForSelector('#responsive')
  await page.waitForSelector('.modal-body');
  await page.waitForTimeout(1000);
  await page.type('#login-username', email);
  await page.waitForTimeout(1000);
  await page.type('#login-password', password);
  // await page.screenshot({ path: 'enter_password.png' });
  await page.waitForTimeout(1000);
  await page.click('#btn-login');
  await page.waitForTimeout(2000);
  await Promise.all([
    console.log('signing in now'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);
  console.log('Login successful');
}


async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  try {
      await performLogin(page);
      console.log('Login successful. Starting scraping...');
      const scrapedData = [];

      for (const url of productURLs) {
        console.log('Fetching data for URL:', url);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForSelector('span.title-breadcrumb.text-bold');
    
        const Name = await page.$eval('span.title-breadcrumb.text-bold', Name => Name.textContent.trim());
        const Item_Number = await page.$eval('div.col-sm-12.col-md-5.col-lg-5.col-xs-12 h4', item => item.textContent.trim().slice(7, 14));
        const Description = await page.$$eval('#SelectProduct > div.col-sm-12.col-md-12.col-lg-10.product-detail-container > div > div.widget-content > div.col-sm-12.col-md-5.col-lg-5.col-xs-12 > ul > li', lis => lis.map(li => li.textContent.trim()));
        const infoSelector = '#collapseInternalInfo3 > div > ul > li:nth-child(2)';
        const infoElement = await page.$(infoSelector);

        let Internal_Info = null;
        let internalInfoArray = [];

        for(let i = 1; i < 20; i++) {
          const infoSelector = `#collapseInternalInfo3 > div > ul > li:nth-child(${i})`;
          const infoElement = await page.$(infoSelector);

          if (infoElement !== null) {
            Internal_Info = await page.$eval(infoSelector, info => info.textContent.trim());
            internalInfoArray.push(Internal_Info);
          } 
        }

        const rows = await page.$$('table#USpriceTable tbody tr'); 
        const tableData = [];

        for (const row of rows) {
          const columns = await row.$$('td'); // Select all columns in the row
          const rowData = [];
          for (const column of columns) {
              const cellText = await column.evaluate(cell => cell.textContent.trim());
              rowData.push(cellText);
          }
          tableData.push(rowData); // Push the data of this row into the tableData array
      }
      
      // scrapedData.push({ url, Name, Item_Number, Internal_Info: internalInfoArray /* Add other scraped data properties here */ });
      scrapedData.push({ url, Name, Item_Number, Pricing: tableData, Description, Internal_Info  });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const jsonData = JSON.stringify(scrapedData, null, 2);

      const outputPath = './product-update.json';
      fs.writeFileSync(outputPath, jsonData);

    }

  } catch (error) {
      console.error('Error during scraping:', error.message);
  } finally {
      await browser.close();
  }
}


main();