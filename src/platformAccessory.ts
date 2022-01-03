import { Service, PlatformAccessory } from "homebridge";

import { ThermobeaconWs08Platform } from "./platform";
import { read } from "./thermobeacon-ws08";

export interface ThermobeaconWs08Context {
  macAddr: string;
  displayName: string;
}

const LOW_BATTERY = 10; // 10%
const UPDATE_INTERVAL = 1000 * 60; // 1 minute

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ThermobeaconWs08Accessory {
  private thermometer: Service;
  private hygrometer: Service;
  private devices: Service[];

  constructor(
    private readonly platform: ThermobeaconWs08Platform,
    private readonly accessory: PlatformAccessory<ThermobeaconWs08Context>
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        "Sensor Blue"
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        "ThermoBeacon ws08"
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        "Default-Serial"
      );

    this.thermometer =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.hygrometer =
      this.accessory.getService(this.platform.Service.HumiditySensor) ||
      this.accessory.addService(this.platform.Service.HumiditySensor);

    this.devices = [this.thermometer, this.hygrometer];

    for (const service of this.devices) {
      service.setCharacteristic(
        this.platform.Characteristic.Name,
        accessory.context.displayName
      );
    }

    setInterval(async () => {
      const { te, hu, bt } = (await read(this.accessory.context.macAddr)) ?? {};

      this.platform.log.debug("Get Sensor values", te, hu, bt);

      if (!te || !hu || !bt) {
        for (const service of this.devices) {
          service.updateCharacteristic(
            this.platform.Characteristic.StatusFault,
            this.platform.Characteristic.StatusFault.GENERAL_FAULT
          );
        }

        return;
      }

      this.thermometer.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        te
      );

      this.hygrometer.updateCharacteristic(
        this.platform.Characteristic.CurrentRelativeHumidity,
        hu
      );

      for (const service of this.devices) {
        service.updateCharacteristic(
          this.platform.Characteristic.StatusFault,
          this.platform.Characteristic.StatusFault.NO_FAULT
        );

        service.updateCharacteristic(
          this.platform.Characteristic.StatusLowBattery,
          bt <= LOW_BATTERY
            ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
            : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
        );
      }
    }, UPDATE_INTERVAL);
  }
}
