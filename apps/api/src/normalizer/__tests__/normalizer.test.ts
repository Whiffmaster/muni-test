import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseCsv, sniffDelimiter } from "../csv.js";
import { decodeBuffer } from "../encoding.js";
import { parseDate } from "../fields/date.js";
import { splitName, parseEmail } from "../fields/name.js";
import { parseDecimal } from "../fields/number.js";
import { parseBirthNumber } from "../fields/personalId.js";
import { canonicalDepartment, normalizeWordCase } from "../fields/text.js";
import {
  detectKind,
  normalizeCsvBuffer,
  normalizeCsvString,
  UnknownDatasetError,
} from "../index.js";

const dataDir = fileURLToPath(new URL("../../../../../data/", import.meta.url));

const readData = (name: string) => readFileSync(`${dataDir}${name}`);

describe("csv parsing", () => {
  it("detects the delimiter", () => {
    expect(sniffDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(sniffDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("keeps a quoted comma inside a field", () => {
    const table = parseCsv('id,email\nE1,"a@b,c"');
    expect(table.rows[0]).toEqual(["E1", "a@b,c"]);
  });

  it("keeps a quoted delimiter and a newline inside a field", () => {
    const table = parseCsv('a;b\n"one;two\nthree";x');
    expect(table.rows[0]).toEqual(["one;two\nthree", "x"]);
  });

  it("unescapes doubled quotes", () => {
    const table = parseCsv('a\n"say ""hi"""');
    expect(table.rows[0]).toEqual(['say "hi"']);
  });

  it("strips the byte order mark from the header", () => {
    const table = parseCsv("\uFEFFid,name\n1,x");
    expect(table.header).toEqual(["id", "name"]);
  });

  it("does not treat a quote inside a field as a quoted section", () => {
    const table = parseCsv('a,b\nx"y,z');
    expect(table.rows[0]).toEqual(['x"y', "z"]);
  });
});

describe("encoding", () => {
  it("reads utf-8 with a byte order mark", () => {
    const decoded = decodeBuffer(Buffer.from("\uFEFFahoj", "utf-8"));
    expect(decoded.encoding).toBe("utf-8");
    expect(decoded.text).toBe("ahoj");
  });

  it("falls back to windows-1250", () => {
    const decoded = decodeBuffer(readData("absolvovana_skoleni.csv"));
    expect(decoded.encoding).toBe("windows-1250");
    expect(decoded.text).toContain("Interní školitel");
  });
});

describe("dates", () => {
  it("parses iso dates", () => {
    expect(parseDate("2024-10-04").value).toBe("2024-10-04");
  });

  it("parses czech dates", () => {
    expect(parseDate("7. 2. 2025").value).toBe("2025-02-07");
    expect(parseDate("07.10.2024").value).toBe("2024-10-07");
    expect(parseDate("15.01.2019").value).toBe("2019-01-15");
  });

  it("rejects dates that do not exist", () => {
    const result = parseDate("31. 9. 2026");
    expect(result.value).toBeNull();
    expect(result.reason).toBe("invalid-date");
  });

  it("reads excel serial numbers", () => {
    expect(parseDate("43552").value).toBe("2019-03-28");
  });

  it("reports empty values", () => {
    expect(parseDate("").reason).toBe("empty");
    expect(parseDate(null).reason).toBe("empty");
  });
});

describe("amounts", () => {
  it("parses czech amounts", () => {
    expect(parseDecimal("450,00").value).toBe(450);
    expect(parseDecimal("1 300,00").value).toBe(1300);
    expect(parseDecimal("2 100 Kč").value).toBe(2100);
    expect(parseDecimal("450,- Kč").value).toBe(450);
    expect(parseDecimal("zdarma").value).toBe(0);
    expect(parseDecimal("-100,00").value).toBe(-100);
    expect(parseDecimal("800").value).toBe(800);
  });

  it("keeps empty values empty", () => {
    expect(parseDecimal("").value).toBeNull();
    expect(parseDecimal("abc").value).toBeNull();
  });
});

describe("names", () => {
  it("splits surname first", () => {
    expect(splitName("Vacková Hana", "surname-first")).toEqual({
      firstName: "Hana",
      lastName: "Vacková",
      fullName: "Hana Vacková",
    });
  });

  it("splits given name first", () => {
    expect(splitName("Tereza Urbanová", "given-first")?.fullName).toBe("Tereza Urbanová");
  });

  it("fixes the casing", () => {
    expect(normalizeWordCase("LUCIE")).toBe("Lucie");
    expect(normalizeWordCase("růžička")).toBe("Růžička");
    expect(normalizeWordCase("Šebestová")).toBe("Šebestová");
  });

  it("normalizes e-mail addresses", () => {
    expect(parseEmail("tereza.jandova @vzorova.example").value).toBe(
      "tereza.jandova@vzorova.example",
    );
    expect(parseEmail("marek.havel@vzorova").valid).toBe(false);
  });
});

describe("departments", () => {
  it("maps the variants onto one canonical name", () => {
    expect(canonicalDepartment("správa budov")).toBe("Správa budov");
    expect(canonicalDepartment("SPRÁVA BUDOV")).toBe("Správa budov");
    expect(canonicalDepartment("Studijní")).toBe("Studijní oddělení");
    expect(canonicalDepartment("Studijni oddeleni")).toBe("Studijní oddělení");
    expect(canonicalDepartment("Laboratore")).toBe("Laboratoře");
  });
});

describe("birth numbers", () => {
  it("keeps the format and reports an impossible date", () => {
    const result = parseBirthNumber("665917/0359");
    expect(result.value).toBe("665917/0359");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid-date");
  });

  it("keeps the format and reports an invalid checksum", () => {
    const result = parseBirthNumber("090731/1234");
    expect(result.value).toBe("090731/1234");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid-checksum");
  });

  it("accepts a number with a valid checksum", () => {
    const result = parseBirthNumber("090731/0008");
    expect(result.value).toBe("090731/0008");
    expect(result.valid).toBe(true);
  });
});

describe("dataset detection", () => {
  it("recognizes a dataset by its header", () => {
    expect(detectKind(["id_zamestnance", "jmeno", "prijmeni", "utvar"])).toBe("zamestnanci");
    expect(detectKind(["id_terminu", "kapacita", "obsazeno"])).toBe("terminy_skoleni");
  });

  it("falls back to the file name", () => {
    expect(detectKind(["something", "else"], "katalog_skoleni.csv")).toBe("katalog_skoleni");
  });

  it("throws for an unknown dataset", () => {
    expect(() => normalizeCsvString("a,b\n1,2")).toThrow(UnknownDatasetError);
  });
});

describe("the files in data/", () => {
  it("normalizes the employees", () => {
    const result = normalizeCsvBuffer(readData("zamestnanci.csv"), {
      kind: "zamestnanci",
      fileName: "zamestnanci.csv",
    });

    expect(result.kind).toBe("zamestnanci");
    expect(result.rows).toHaveLength(174);
    expect(result.meta.encoding).toBe("utf-8");
    expect(result.meta.delimiter).toBe(",");

    const first = result.rows[0];
    expect(first.id).toBe("E0001");
    expect(first.fullName).toBe("Tereza Urbanová");
    expect(first.hiredAt).toBe("2008-02-23");
    expect(first.department).toBe("Studijní oddělení");
    expect(first.statusKey).toBe("aktivni");

    // every date is iso or null
    for (const row of result.rows) {
      expect(row.hiredAt === null || /^\d{4}-\d{2}-\d{2}$/.test(row.hiredAt)).toBe(true);
      expect(row.terminatedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(row.terminatedAt)).toBe(true);
    }

    // only the genuinely broken e-mails are reported
    const errors = result.warnings.filter((warning) => warning.level === "warning");
    expect(errors).toHaveLength(4);
    expect(errors.every((warning) => warning.code === "invalid-email")).toBe(true);
  });

  it("normalizes the catalogue", () => {
    const result = normalizeCsvBuffer(readData("katalog_skoleni.csv"), {
      kind: "katalog_skoleni",
      fileName: "katalog_skoleni.csv",
    });

    expect(result.kind).toBe("katalog_skoleni");
    expect(result.rows).toHaveLength(10);
    expect(result.warnings).toHaveLength(0);

    const bozp = result.rows[0];
    expect(bozp.code).toBe("BOZP-Z");
    expect(bozp.validityMonths).toBe(24);
    expect(bozp.requiredFor.everyone).toBe(true);

    const prvPom = result.rows.find((row) => row.code === "PRV-POM");
    expect(prvPom?.requiredFor.departments).toContain("Laboratoře");
    expect(prvPom?.requiredFor.departments).toContain("Knihovna");

    const zdvih = result.rows.find((row) => row.code === "ZDVIH");
    expect(zdvih?.validityMonths).toBe(24);
    expect(zdvih?.validityText).toBe("2 roky");
  });

  it("normalizes the sessions", () => {
    const result = normalizeCsvBuffer(readData("terminy_skoleni.csv"), {
      kind: "terminy_skoleni",
      fileName: "terminy_skoleni.csv",
    });

    expect(result.kind).toBe("terminy_skoleni");
    expect(result.rows).toHaveLength(34);
    expect(result.meta.delimiter).toBe(";");

    const first = result.rows[0];
    expect(first.startTime).toBe("09:00");
    expect(first.endTime).toBe("12:00");
    expect(first.freeSpots).toBe(3);
    expect(first.overbooked).toBe(false);

    // 31. 9. 2026 does not exist
    const broken = result.rows.find((row) => row.id === "T014");
    expect(broken?.date).toBeNull();

    // 2 100 Kč
    const withCurrency = result.rows.find((row) => row.id === "T033");
    expect(withCurrency?.pricePerPerson).toBe(2100);

    const overbooked = result.rows.filter((row) => row.overbooked).map((row) => row.id);
    expect(overbooked).toEqual(["T016", "T030"]);
  });

  it("normalizes the completed trainings", () => {
    const result = normalizeCsvBuffer(readData("absolvovana_skoleni.csv"), {
      kind: "absolvovana_skoleni",
      fileName: "absolvovana_skoleni.csv",
    });

    expect(result.kind).toBe("absolvovana_skoleni");
    expect(result.meta.encoding).toBe("windows-1250");
    expect(result.meta.delimiter).toBe(";");
    // The repeated header line inside the file and the notes at the end of the
    // file are skipped - the file itself says "Celkem 2865".
    expect(result.rows).toHaveLength(2865);
    expect(
      result.warnings.filter((warning) => warning.code === "not-a-record").length,
    ).toBeGreaterThan(0);

    // surname first becomes first name last name
    expect(result.rows[2].employeeName).toBe("Adam Blažek");
    expect(result.rows[2].completedAt).toBe("2019-01-06");

    // the multi line notes survive, including the delimiter inside them
    const withNote = result.rows.find((row) => row.id === "Z001958");
    expect(withNote?.note).toBe("Absolvoval „náhradní termín“;\nviz e-mail z 3. 2.");

    const withQuotedNote = result.rows.find((row) => row.id === "Z002114");
    expect(withQuotedNote?.note).toContain('"zrušeno"');

    // no hard errors, only informational notes
    expect(result.warnings.filter((warning) => warning.level === "warning")).toHaveLength(0);
  });
});
