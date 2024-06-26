import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";

const main_url: string = "https://www.icd10data.com/ICD10CM/Codes"

const fetchData = async (url: string) => {
  const result = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    },
  });
  return result;
};

const main = async () => {
  console.log("Starting Scraping");
  const result = await fetchData(main_url);

  const main_selector = cheerio.load(result.data);

  interface InitialData {
    code: string;
    name: string;
    description?: string;
    data?: InitialData[];
  };

  const scraped_data: InitialData[] = [];

  const elements = main_selector(".body-content > ul > li").toArray();

  for (const element of elements) {
    if (!main_selector(element).hasClass("proper-ad-unit")) {
      const fetchedString = main_selector(element).text().trim();
      const main_code = fetchedString.split(" ")[0];
      const limit_selector_url = main_url + "/" + main_code;
      const limit_selector_result = await fetchData(limit_selector_url);
      const limit_selector = cheerio.load(limit_selector_result.data);
      const data_elements = limit_selector(".body-content > ul > li").toArray();
      for (const limit_elements of data_elements) {
        if (!limit_selector(limit_elements).hasClass("proper-ad-unit")) {
          const fetchedString = limit_selector(limit_elements).text().trim();
          const limit_code = fetchedString.split(" ")[0];
          const category_selector_url = limit_selector_url + "/" + limit_code;
          const category_selector_result = await fetchData(category_selector_url);
          const category_selector = cheerio.load(category_selector_result.data);
          const category_elements = category_selector(".body-content > ul > li").toArray();
          for (const icd_element of category_elements) {
            if (!category_selector(icd_element).hasClass("proper-ad-unit")) {
              const fetchedString = category_selector(icd_element).text().trim();
              const icd_code = fetchedString.split(" ")[0];
              const exact_selector_url = category_selector_url + "/" + icd_code + "-";
              const exact_selector_result = await fetchData(exact_selector_url);
              const exact_selector = cheerio.load(exact_selector_result.data);
              const recursiveTraverse = (parent: cheerio.Cheerio<cheerio.Element>, parent_name: string = ""): InitialData[] => {
                const exact_elements: InitialData[] = [];
                exact_selector(parent).children("li.codeLine").each((_, el) => {
                  const code = exact_selector(el).find("a").first().text().trim();
                  let name = exact_selector(el).find("span").not('a').text().trim().split(" ").slice(1).join(" ").split(code)[0];
                  if (name.startsWith("……")) {
                    name = parent_name + " " + name.slice(3);
                  };
                  const data: InitialData = { code, name };
                  exact_elements.push(data);
                  console.debug(data);
                  scraped_data.push(data);
                  const nestedUL = exact_selector(el).children("ul");
                  if (nestedUL.length > 0) {
                    const nestedElements = recursiveTraverse(nestedUL, name);
                    exact_elements.push(...nestedElements);
                  };
                });
                return exact_elements;
              };
              recursiveTraverse(exact_selector(".body-content > ul.codeHierarchy"));
            };
          };
        };
      };
    };
  };
  console.log("Finished Scraping");
  console.log("Writing to JSON file");
  fs.writeFileSync("icd10.json", JSON.stringify(scraped_data, null, 2));
  console.log("Finished Writing to JSON file");
};

await main();