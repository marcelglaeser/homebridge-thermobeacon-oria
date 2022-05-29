import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge";
import createFakeGatoHistory from "fakegato-history";

import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import {
  ThermobeaconOriaAccessory,
  ThermobeaconOriaSensorConfig,
} from "./platformAccessory";

export class ThermobeaconOriaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;
  public readonly FakeGatoHistoryService = createFakeGatoHistory(this.api);

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    this.api.on("didFinishLaunching", () => {
      log.debug("Executed didFinishLaunching callback");

      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    this.accessories.push(accessory);
  }

  discoverDevices() {
    const devices: ThermobeaconOriaSensorConfig[] = this.config.sensors;

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.macAddress);

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      ) as PlatformAccessory<ThermobeaconOriaSensorConfig>;

      if (existingAccessory) {
        this.log.info(
          "Restoring existing accessory from cache:",
          existingAccessory.displayName
        );

        new ThermobeaconOriaAccessory(this, existingAccessory);
      } else {
        this.log.info("Adding new accessory:", device.name);

        const accessory = new this.api.platformAccessory(
          device.name,
          uuid
        ) as PlatformAccessory<ThermobeaconOriaSensorConfig>;

        accessory.context = device;

        new ThermobeaconOriaAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }
}
