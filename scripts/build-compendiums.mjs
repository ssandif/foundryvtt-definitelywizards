import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const systemManifest = JSON.parse(fs.readFileSync(path.join(rootDir, "system.json"), "utf8"));
const systemId = systemManifest.id;
const systemVersion = systemManifest.version;
const coreVersion = systemManifest.compatibility?.verified;
if (!systemId || !systemVersion || !coreVersion) {
    throw new Error("system.json must define id, version, and compatibility.verified.");
}

const NOW = Date.now();
const BASE_STATS = {
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null,
    coreVersion,
    systemId,
    systemVersion,
    createdTime: NOW,
    modifiedTime: NOW,
    lastModifiedBy: null,
};

function createMacroEntry({ id, name, img, command, sort }) {
    return {
        _id: id,
        name,
        type: "script",
        author: null,
        img,
        scope: "global",
        command,
        folder: null,
        sort,
        ownership: { default: 0 },
        flags: {},
        _stats: { ...BASE_STATS },
    };
}

const GM_MACROS = [
    createMacroEntry({
        id: "dwExamGenMacro01",
        name: "Generate Practical Exam",
        img: "systems/definitely-wizards/resources/icons/macro-exam.svg",
        command: [
            "if (!game.user.isGM) {",
            '    ui.notifications.warn(game.i18n?.localize("DW.ExamGMOnlyWarning") || "Only the GM can generate a Practical Exam.");',
            "} else {",
            "    await game.definitelyWizards?.generatePracticalExam();",
            "}",
        ].join("\n"),
        sort: 100000,
    }),
];

const PLAYER_MACROS = [
    createMacroEntry({
        id: "dwWizMacro1d6001",
        name: "Wizard (1d6)",
        img: "systems/definitely-wizards/resources/icons/macro-wizard-1d6.svg",
        command:
            'await game.definitelyWizards?.rollStatMacro({ isWizardRoll: true, formula: "1d6" });',
        sort: 100000,
    }),
    createMacroEntry({
        id: "dwWizMacroWit002",
        name: "Wizard (Wit Bonus)",
        img: "systems/definitely-wizards/resources/icons/macro-wizard-wit.svg",
        command:
            'await game.definitelyWizards?.rollStatMacro({ isWizardRoll: true, formula: "2d6kl" });',
        sort: 200000,
    }),
    createMacroEntry({
        id: "dwWildMacro1d603",
        name: "Wild (1d6)",
        img: "systems/definitely-wizards/resources/icons/macro-wild-1d6.svg",
        command:
            'await game.definitelyWizards?.rollStatMacro({ isWizardRoll: false, formula: "1d6" });',
        sort: 300000,
    }),
    createMacroEntry({
        id: "dwWildMacroWit04",
        name: "Wild (Wit Bonus)",
        img: "systems/definitely-wizards/resources/icons/macro-wild-wit.svg",
        command:
            'await game.definitelyWizards?.rollStatMacro({ isWizardRoll: false, formula: "2d6kl" });',
        sort: 400000,
    }),
];

function verifyPackManifest(packDir) {
    const manifestName = fs.readFileSync(path.join(packDir, "CURRENT"), "utf8").trim();
    if (!/^MANIFEST-\d+$/.test(manifestName) || !fs.existsSync(path.join(packDir, manifestName))) {
        throw new Error(`Invalid CURRENT manifest in ${packDir}: ${manifestName}`);
    }
}

async function buildMacroPack(packDirName, macros) {
    const packDir = path.join(rootDir, "packs", packDirName);
    fs.rmSync(packDir, { recursive: true, force: true });
    fs.mkdirSync(packDir, { recursive: true });

    const db = new ClassicLevel(packDir, {
        keyEncoding: "utf8",
        valueEncoding: "json",
        createIfMissing: true,
    });
    await db.open();

    const macrosSub = db.sublevel("macros", { keyEncoding: "utf8", valueEncoding: "json" });
    let keys;
    try {
        for (const macro of macros) {
            await macrosSub.put(macro._id, macro);
        }
        keys = await db.keys().all();
    } finally {
        await db.close();
    }

    const invalidKeys = keys.filter((key) => !key.startsWith("!macros!"));
    if (keys.length === 0 || invalidKeys.length > 0) {
        throw new Error(`Unexpected keys in ${packDirName}: ${JSON.stringify(invalidKeys)}`);
    }
    verifyPackManifest(packDir);
    console.log(`Built ${packDirName} (${keys.length} LevelDB keys).`);
}

await buildMacroPack("definitely-wizards-macros", GM_MACROS);
await buildMacroPack("definitely-wizards-player-macros", PLAYER_MACROS);
