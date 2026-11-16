import { DefinitelyWizardsActor } from "./actor.js";
import { DefinitelyWizardsActorSheet } from "./actor-sheet.js";
import * as Chat from "./chat.js";
import {
    CharacterDataModel,
    DEFINITELY_WIZARDS,
    DefinitelyWizardsItemDataModel,
} from "./data-models.js";
import { EXAM_ROLL_TABLES, generatePracticalExam } from "./exam-generator.js";
import { DefinitelyWizardsItem } from "./item.js";
import { DefinitelyWizardsItemSheet } from "./item-sheet.js";
import {
    initMacroListeners,
    onHotbarDrop,
    rollItemMacro,
    rollStatMacro,
    seedDefaultPlayerHotbars,
} from "./macros.js";

Hooks.once("init", async () => {
    console.log("DefinitelyWizards: Initializing");

    initMacroListeners();

    game.settings.register("definitely-wizards", "autoPopulateHotbar", {
        name: "DW.SettingAutoPopulateHotbarName",
        hint: "DW.SettingAutoPopulateHotbarHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    CONFIG.DEFINITELY_WIZARDS = DEFINITELY_WIZARDS;
    CONFIG.Actor.documentClass = DefinitelyWizardsActor;
    CONFIG.Item.documentClass = DefinitelyWizardsItem;
    CONFIG.Actor.dataModels.character = CharacterDataModel;
    CONFIG.Item.dataModels.Prop = DefinitelyWizardsItemDataModel;
    CONFIG.Item.dataModels.Spell = DefinitelyWizardsItemDataModel;
    CONFIG.Item.dataModels.MiscItem = DefinitelyWizardsItemDataModel;

    game.definitelyWizards = {
        generatePracticalExam,
        rollStatMacro,
        rollItemMacro,
    };

    const { DocumentSheetConfig } = foundry.applications.apps;
    DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
    DocumentSheetConfig.registerSheet(Actor, "definitely-wizards", DefinitelyWizardsActorSheet, {
        label: "Definitely Wizards Character Sheet (Default)",
        makeDefault: true,
    });

    DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
    DocumentSheetConfig.registerSheet(Item, "definitely-wizards", DefinitelyWizardsItemSheet, {
        label: "Definitely Wizards Item Sheet (Default)",
        makeDefault: true,
    });
});

Hooks.once("ready", async () => {
    if (!game.users.activeGM?.isSelf) return;

    const defaultTableIcons = new Set(["icons/svg/d20-black.svg", "icons/svg/d20-grey.svg"]);
    const existingByName = new Map(game.tables.contents.map((doc) => [doc.name, doc]));
    const rollTablesToAdd = [];

    for (const spec of Object.values(EXAM_ROLL_TABLES)) {
        let existing = existingByName.get(spec.name);
        let matchedLegacy = false;
        if (!existing) {
            for (const legacyName of spec.legacyNames) {
                existing = existingByName.get(legacyName);
                if (existing) {
                    matchedLegacy = true;
                    break;
                }
            }
        }

        if (!existing) {
            const rollTable = await foundry.utils.fetchJsonWithTimeout(spec.url);
            rollTablesToAdd.push(rollTable);
            continue;
        }

        const needsRename = matchedLegacy && !existingByName.has(spec.name);
        const needsTableImg = defaultTableIcons.has(existing.img ?? "");
        const resultsToUpdate =
            existing.results?.filter?.((res) => defaultTableIcons.has(res.img ?? "")) ?? [];

        if (!needsRename && !needsTableImg && resultsToUpdate.length === 0) continue;

        /** @type {Record<string, any>} */
        const updateData = {};
        if (needsRename) {
            updateData.name = spec.name;
        }

        let targetImg = "";
        if (needsTableImg || resultsToUpdate.length > 0) {
            const rollTable = await foundry.utils.fetchJsonWithTimeout(spec.url);
            targetImg = rollTable?.img ?? "";
            if (needsTableImg && targetImg) {
                updateData.img = targetImg;
            }
        }

        if (Object.keys(updateData).length > 0) {
            await existing.update?.(updateData);
            if (needsRename) {
                existingByName.delete(existing.name);
                existingByName.set(spec.name, existing);
            }
        }
        if (targetImg && resultsToUpdate.length > 0) {
            await existing.updateEmbeddedDocuments?.(
                "TableResult",
                resultsToUpdate.map((res) => ({ _id: res.id, img: targetImg })),
            );
        }
    }

    if (rollTablesToAdd.length > 0) {
        await RollTable.createDocuments(rollTablesToAdd);
    }

    await seedDefaultPlayerHotbars();
});

Hooks.on("renderChatMessageHTML", (message, html) => Chat.addChatListeners(message, html));
Hooks.on("createChatMessage", (message) => Chat.onCreateChatMessage(message));
Hooks.on("deleteChatMessage", (message) => Chat.onDeleteChatMessage(message));
Hooks.on("hotbarDrop", onHotbarDrop);
Hooks.on("createUser", (user) => {
    if (game.users.activeGM?.isSelf) {
        void seedDefaultPlayerHotbars({ targetUser: user });
    }
});
