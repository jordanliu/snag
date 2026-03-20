import { startBridgeController } from "../lib/background/bridge-controller";

export default defineBackground(() => {
  startBridgeController();
});
