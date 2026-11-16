/**
 * Canonical definitions for the Practical Exam and Monster Factory RollTables.
 */
export const EXAM_ROLL_TABLES = {
    judge: {
        name: "Judge",
        legacyNames: [],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-judge.json",
    },
    roomType: {
        name: "Room Type",
        legacyNames: ["RoomType"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-room-type.json",
    },
    mainObstacle: {
        name: "Main Obstacle",
        legacyNames: ["MainObstacle"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-main-obstacle.json",
    },
    addedChallenge: {
        name: "Added Challenge",
        legacyNames: ["AddedChallenge"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-added-challenge.json",
    },
    surprise: {
        name: "Surprise",
        legacyNames: [],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-surprise.json",
    },
    finalTest: {
        name: "Final Test",
        legacyNames: ["FinalTest"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-final-test.json",
    },
    monsterCreature: {
        name: "Monster Factory Creature",
        legacyNames: ["MonsterFactoryCreature"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-monster-factory-creature.json",
    },
    monsterTrait: {
        name: "Monster Factory Trait",
        legacyNames: ["MonsterFactoryTrait"],
        url: "systems/definitely-wizards/resources/roll-tables/fvtt-RollTable-monster-factory-trait.json",
    },
};

/**
 * Look up a world RollTable by its canonical name, falling back to legacy PascalCase names.
 * @param {keyof typeof EXAM_ROLL_TABLES} tableKey
 * @returns {RollTable | undefined}
 */
function resolveExamRollTable(tableKey) {
    const spec = EXAM_ROLL_TABLES[tableKey];
    const direct = game.tables.getName(spec.name);
    if (direct) return direct;
    for (const legacyName of spec.legacyNames) {
        const legacy = game.tables.getName(legacyName);
        if (legacy) return legacy;
    }
    return undefined;
}

/**
 * Draw formatted result strings from a world RollTable, optionally expanding roll-6 "roll again twice".
 * @param {keyof typeof EXAM_ROLL_TABLES} tableKey
 * @param {object} [options]
 * @param {boolean} [options.allowDouble=false]
 * @param {boolean} [options.rerollSixes=false]
 * @param {number} [options.depth=0]
 * @returns {Promise<string[]>}
 */
async function drawTableTexts(
    tableKey,
    { allowDouble = false, rerollSixes = false, depth = 0 } = {},
) {
    const spec = EXAM_ROLL_TABLES[tableKey];
    const table = resolveExamRollTable(tableKey);
    if (!table) {
        return [
            `<em>${game.i18n.format("DW.ExamMissingRollTable", {
                name: foundry.utils.escapeHTML(spec.name),
            })}</em>`,
        ];
    }

    const { roll, results } = await table.roll();
    const isRollAgainTwice = allowDouble && rerollSixes && roll.total === 6 && depth < 3;
    if (isRollAgainTwice) {
        const first = await drawTableTexts(tableKey, {
            allowDouble: true,
            rerollSixes: true,
            depth: depth + 1,
        });
        const second = await drawTableTexts(tableKey, {
            allowDouble: true,
            rerollSixes: true,
            depth: depth + 1,
        });
        return [...first, ...second];
    }

    return results.map((res) => {
        const raw = res.description || res.name || "";
        return raw
            .replace(/^<p>/i, "")
            .replace(/<\/p>$/i, "")
            .trim();
    });
}

/**
 * Render an array of rolled table entries into an HTML snippet.
 * @param {string[]} items
 * @returns {string}
 */
function formatEntryList(items) {
    if (items.length === 1) return items[0];
    return `<ul>${items.map((text) => `<li>${text}</li>`).join("")}</ul>`;
}

/**
 * Interactive GM helper to generate a complete 4-Chamber Wizard Certification Practical Exam.
 * @returns {Promise<JournalEntry | ChatMessage | null>}
 */
export async function generatePracticalExam() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DW.ExamGMOnlyWarning"));
        return null;
    }

    const { escapeHTML } = foundry.utils;
    const formValues = await foundry.applications.api.DialogV2.input({
        window: { title: game.i18n.localize("DW.ExamDialogTitle") },
        content: `
            <div class="form-group">
                <label>${escapeHTML(game.i18n.localize("DW.ExamOutputLabel"))}</label>
                <select name="output">
                    <option value="journal" selected>${escapeHTML(game.i18n.localize("DW.ExamOutputJournal"))}</option>
                    <option value="chat">${escapeHTML(game.i18n.localize("DW.ExamOutputChat"))}</option>
                </select>
            </div>
            <div class="form-group">
                <label><input type="checkbox" name="rerollSixes" checked /> ${escapeHTML(game.i18n.localize("DW.ExamRerollSixesLabel"))}</label>
            </div>
            <div class="form-group">
                <label><input type="checkbox" name="includeMonsterFactory" /> ${escapeHTML(game.i18n.localize("DW.ExamIncludeBossLabel"))}</label>
            </div>
        `,
        ok: { label: game.i18n.localize("DW.ExamGenerateButton") },
        rejectClose: false,
        modal: true,
    });

    if (!formValues) return null;

    const rerollSixes = Boolean(formValues.rerollSixes);
    const includeBoss = Boolean(formValues.includeMonsterFactory);
    const output = formValues.output === "chat" ? "chat" : "journal";

    const [judge] = await drawTableTexts("judge");

    const chamberSpecs = [
        {
            label: game.i18n.format("DW.ExamChamberTitle", { number: 1 }),
            added: false,
            surprise: false,
            finalTest: false,
        },
        {
            label: game.i18n.format("DW.ExamChamberTitle", { number: 2 }),
            added: true,
            surprise: false,
            finalTest: false,
        },
        {
            label: game.i18n.format("DW.ExamChamberTitle", { number: 3 }),
            added: true,
            surprise: true,
            finalTest: false,
        },
        {
            label: game.i18n.format("DW.ExamFinalChamberTitle", { number: 4 }),
            added: true,
            surprise: true,
            finalTest: true,
        },
    ];

    const sections = [
        `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamJudgeLabel"))}</strong> ${judge}</p>`,
    ];

    for (const chamber of chamberSpecs) {
        const room = await drawTableTexts("roomType");
        const obstacle = await drawTableTexts("mainObstacle", { allowDouble: true, rerollSixes });

        const rows = [
            `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamRoomTypeLabel"))}</strong> ${formatEntryList(room)}</p>`,
            `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamMainObstacleLabel"))}</strong> ${formatEntryList(obstacle)}</p>`,
        ];

        if (chamber.added) {
            const added = await drawTableTexts("addedChallenge", {
                allowDouble: true,
                rerollSixes,
            });
            rows.push(
                `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamAddedChallengeLabel"))}</strong> ${formatEntryList(added)}</p>`,
            );
        }

        if (chamber.surprise) {
            const surprise = await drawTableTexts("surprise", { allowDouble: true, rerollSixes });
            rows.push(
                `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamSurpriseLabel"))}</strong> ${formatEntryList(surprise)}</p>`,
            );
        }

        if (chamber.finalTest) {
            const finalTest = await drawTableTexts("finalTest", {
                allowDouble: true,
                rerollSixes,
            });
            rows.push(
                `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamFinalTestLabel"))}</strong> ${formatEntryList(finalTest)}</p>`,
            );

            if (includeBoss) {
                const [creature] = await drawTableTexts("monsterCreature");
                const [trait] = await drawTableTexts("monsterTrait");
                rows.push(
                    `<p><strong>${escapeHTML(game.i18n.localize("DW.ExamBossLabel"))}</strong> ${trait} ${creature}</p>`,
                );
            }
        }

        sections.push(`<h2>${escapeHTML(chamber.label)}</h2>${rows.join("")}`);
    }

    const htmlContent = sections.join("");

    if (output === "journal") {
        const journal = await JournalEntry.create({
            name: game.i18n.format("DW.ExamJournalName", {
                date: new Date().toLocaleDateString(),
            }),
            pages: [
                {
                    name: game.i18n.localize("DW.ExamJournalPageName"),
                    type: "text",
                    text: { content: htmlContent },
                },
            ],
        });
        await journal?.sheet?.render(true);
        return journal ?? null;
    }

    const gmUsers = game.users.filter((u) => u.isGM).map((u) => u.id);
    return (
        (await ChatMessage.create({
            user: game.user.id,
            whisper: gmUsers,
            content: `<div class="definitelywizards chat-card"><h2>${escapeHTML(game.i18n.localize("DW.ExamChatTitle"))}</h2>${htmlContent}</div>`,
        })) ?? null
    );
}
