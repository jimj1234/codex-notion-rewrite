"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notionClient = void 0;
const client_1 = require("@notionhq/client");
const env_1 = require("../config/env");
exports.notionClient = new client_1.Client({ auth: env_1.env.NOTION_API_KEY });
//# sourceMappingURL=notion.js.map