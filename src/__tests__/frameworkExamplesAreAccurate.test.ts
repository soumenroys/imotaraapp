import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The reply prompt's frameworks each carry a "Myth:" example. The model quotes
 * them almost word for word (the false Draupadi line reached 3 of 6 live
 * replies), so every one must say what its source actually says.
 * Checked one by one, 26 Oct 2026.
 */
const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");
const MYTHS = SRC.split("\n").filter((l) => /^\s*"\s*Myth:/.test(l));

describe("framework story examples say what their sources say", () => {
    it("there are 31 of them, none empty", () => {
        expect(MYTHS).toHaveLength(31);
        for (const m of MYTHS) expect(m.length).toBeGreaterThan(80);
    });

    it.each([
        ["'amor fati' is Nietzsche's phrase, not the Stoics'", /amor fati/],
        ["Krishna does teach Arjuna — he does not only ask questions", /does not tell Arjuna what to do/],
        ["no 'Dalai Lama begins with himself'", /Dalai Lama/],
        ["no invented Mandela quote", /the prison made him/],
        ["Rama did not go out to receive Vibhishana", /Ram himself goes to receive him/],
        ["no invented Zen 'monkey in the garden' dialogue", /monkey in the garden/],
        ["Krishna never 'misreads Draupadi'", /misreads Draupadi/],
        ["Brahma, not Saraswati, told Valmiki to write", /Saraswati/],
        ["the krauncha bird was not shot 'mid-flight'", /mid-flight/],
        ["no invented Yudhishthira line to Kunti", /why didn't you tell us/],
        ["Hanuman was not shown 'despite fear' — he had forgotten his strength", /fear says turn back/],
        ["the Gita does not discuss pitru-rin", /The Gita speaks of cleaning this/],
        ["the sutta gives no '999'", /999/],
        ["no '(SDT|triangle) failure' framed as the story itself", /SDT failure|trapped in the triangle/],
        ["no psychological label passed off as the story", /attachment wound of Indian mythology|undanced dance|schema of unworthiness|worry postponement at cosmic scale/],
    ])("%s", (_l, bad) => {
        for (const m of MYTHS) expect(m).not.toMatch(bad as RegExp);
    });

    it("cites where a reader can check", () => {
        expect(SRC).toMatch(/do as you wish \(18\.63\)/);
        expect(SRC).toMatch(/never to their fruits \(2\.47\)/);
        expect(SRC).toMatch(/I have stopped, Angulimala\. You stop too\./);
        expect(SRC).toMatch(/Brahma came and told him to tell the whole story of Rama/);
    });
});
