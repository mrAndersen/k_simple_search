const https = require('https');
const moment = require('moment');
const sprintf = require('sprintf-js').sprintf;
const iconv = require("iconv-lite");
const Entities = require('html-entities').AllHtmlEntities;
const fs = require('fs');
const opn = require('opn');
const entities = new Entities();

const Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString('|/-\\');

let daysBack = process.argv[2] || 3;
let urls = [];
let day = moment().subtract(2, 'day').format('YYYY-MM-DD');
let regex = /<div id="obj\d+".+?>\s+<b>.+?<\/b>\s+<a href="(.+?)"\s.+?>(.*?)<\/a>.+?<u.+?>.+?>(\d+)<\/a><\/u>/gs;

let mainPageUrl = "https://www.kinopoisk.ru";
let mainPageCookie = [];

let baseHeaders = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "accept-encoding": "deflate, br",
    "accept-language": "en-US,en;q=0.9,ru-RU;q=0.8,ru;q=0.7,bg;q=0.6,fr;q=0.5,zh-TW;q=0.4,zh;q=0.3,it;q=0.2,cy;q=0.1",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
};

let films = [];
let doneUrls = 0;

let isValidHttpResponse = (url, response) => {
    if (response.statusCode !== 200) {
        console.log(sprintf("\n\t%s => %d", url, response.statusCode));
        return false;
    }

    return true;
};

console.log(sprintf("We will request %d pages from popular database\n", daysBack));

for (let i = 0; i <= daysBack; i++) {
    if (i === 0) {
        urls.push(sprintf("https://www.kinopoisk.ru/popular/day/%s/", day));
    } else {
        urls.push(sprintf("https://www.kinopoisk.ru/popular/day/%s/page/%d/", day, i + 1));
    }
}

https.get(mainPageUrl, {
    headers: baseHeaders
}, (response) => {
    if (isValidHttpResponse(mainPageUrl, response)) {
        mainPageCookie = response.headers["set-cookie"];
    }

    urls.forEach((v, k) => {
        baseHeaders["cookie"] = mainPageCookie.map(function (v, k) {
            return v.split(';')[0];
        }).join('; ');

        let spinner = new Spinner(sprintf('%%s \t %s', v));
        spinner.start();

        https.get(v, {
            headers: baseHeaders
        }, (response) => {
            let buf = [];

            isValidHttpResponse(v, response);

            response.on('data', (data) => {
                buf.push(data);
            });

            response.on('end', function () {
                spinner.stop();
                buf = Buffer.concat(buf);

                let html = iconv.decode(buf, "cp1251");
                let match;

                while (match = regex.exec(html)) {
                    films.push({
                        title: entities.decode(match[2]),
                        url: sprintf("https://www.kinopoisk.ru%s", match[1]),
                        score: match[3],
                    });
                }

                doneUrls++;
                let resultHTML = "";

                if (doneUrls === urls.length) {
                    spinner.stop(true);

                    films.sort((a, b) => {
                        return parseInt(b.score) - parseInt(a.score);
                    }).forEach(function (v, k) {
                        resultHTML += sprintf(
                            "<a href=\"%s\">[+%d] %s</a><br/>",
                            v.url,
                            parseInt(v.score),
                            v.title
                        );
                    });

                    if (fs.exists("list.html")) {
                        fs.unlink("list.html");
                    }

                    let file = fs.createWriteStream("list.html");

                    file.once('open', function (fd) {
                        file.write(resultHTML);
                        file.end();
                        file.close();
                    });

                    opn("list.html");
                }
            });
        });
    });
});






