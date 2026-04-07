import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { getConfig } from "../lib/config.js";

export function registerPrintTools(server: McpServer) {
  server.tool(
    "send_print",
    `Upload a GCode file to the AnkerMake M5 via the AnkerMake desktop app.

This tool opens the AnkerMake app and launches its file-open dialog with the
GCode file pre-filled. Because the app requires GUI interaction to confirm,
the caller (Claude) must follow up with computer-use to complete the upload:

After calling this tool:
1. Use computer-use request_access for "AnkerMake" (if not already granted)
2. Wait ~3s, then screenshot to see the app state
3. If a warning dialog appears ("not sliced by AnkerMake"), click "Yes"
4. A print confirmation screen will show file name, estimated time, and a Print/Cancel button
5. Ask the user whether to click Print or Cancel

WARNING: Clicking Print will physically move the printer and extrude filament.`,
    {
      gcode_path: z.string().describe("Absolute path to the GCode file"),
    },
    async ({ gcode_path }) => {
      try {
        if (!existsSync(gcode_path)) {
          return {
            content: [{ type: "text", text: `GCode file not found: ${gcode_path}` }],
            isError: true,
          };
        }

        if (!gcode_path.toLowerCase().endsWith(".gcode")) {
          return {
            content: [{ type: "text", text: `File must be a .gcode file: ${gcode_path}` }],
            isError: true,
          };
        }

        const config = getConfig();

        if (!existsSync(config.ankermakeAppPath)) {
          return {
            content: [
              {
                type: "text",
                text: `AnkerMake app not found at: ${config.ankermakeAppPath}\nInstall from https://www.ankermake.com/software`,
              },
            ],
            isError: true,
          };
        }

        // Launch AnkerMake app — it will come to foreground
        // We don't wait for it to exit (it's a GUI app)
        const proc = execFile(config.ankermakeAppPath, [], {
          windowsHide: false,
        } as any);
        proc.unref();

        return {
          content: [
            {
              type: "text",
              text:
                `AnkerMake app launched. Complete the upload with computer-use:\n\n` +
                `1. request_access for "AnkerMake" if not already granted\n` +
                `2. Wait ~3s then screenshot — the app should show "Ready to Print"\n` +
                `3. Click "My Computer" button to open the file dialog\n` +
                `4. Type the file path in the "File name" field:\n` +
                `   ${gcode_path}\n` +
                `5. Click "Open"\n` +
                `6. A warning dialog may appear ("not sliced by AnkerMake") — click "Yes"\n` +
                `7. The print confirmation screen shows file name, time estimate, Print/Cancel\n` +
                `8. Ask the user whether to Print or Cancel\n\n` +
                `Use printer_status to monitor progress after printing starts.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to launch AnkerMake app: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
