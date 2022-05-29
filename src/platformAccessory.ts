import { FakeGatoHistoryService } from "fakegato-history";
import { Service, PlatformAccessory } from "homebridge";

import { ThermobeaconOriaPlatform } from "./platform";
import { read, ThermoBeaconOriaReading } from "./thermobeacon-oria";

const LOW_BATTERY = 10; // 10%
const UPDATE_INTERVAL = 1000 * 60; // 1 minute

export interface ThermobeaconOriaSensorConfig {
  name: string;
  macAddress: string;
}

export interface ThermobeaconOriaConfig {
  sensors: ThermobeaconOriaSensorConfig[];
}

export class ThermobeaconOriaAccessory {
  private thermometer: Service;
  private history: FakeGatoHistoryService;
  private hygrometer: Service;
  private battery: Service;

  constructor(
    private readonly platform: ThermobeaconOriaPlatform,
    private readonly accessory: PlatformAccessory<ThermobeaconOriaSensorConfig>
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        "Sensor Blue"
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        "ThermoBeacon oria"
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.macAddress
      );

    this.thermometer =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.hygrometer =
      this.accessory.getService(this.platform.Service.HumiditySensor) ||
      this.accessory.addService(this.platform.Service.HumiditySensor);

    this.battery =
      this.accessory.getService(this.platform.Service.Battery) ||
      this.accessory.addService(this.platform.Service.Battery);

    this.history = new this.platform.FakeGatoHistoryService(
      "weather",
      this.accessory,
      {
        storage: "fs",
        log: this.platform.log,
      }
    );

    for (const service of [this.thermometer, this.hygrometer, this.battery]) {
      service.setCharacteristic(
        this.platform.Characteristic.Name,
        this.accessory.displayName
      );
    }

    this._update();

    setInterval(this._update.bind(this), UPDATE_INTERVAL);
  }

  async _update() {
    let result: ThermoBeaconOriaReading;

    try {
      result = await read(this.accessory.context.macAddress);
    } catch (error) {
      this.platform.log.debug(error as string);
      return;
    }

    const { temperature, humidity, battery } = result;

    if (!temperature || !humidity || !battery) {
      this.platform.log.warn(
        "[%s] Unable to read the sensor",
        this.accessory.displayName
      );

      for (const service of [this.thermometer, this.hygrometer]) {
        service.updateCharacteristic(
          this.platform.Characteristic.StatusFault,
          this.platform.Characteristic.StatusFault.GENERAL_FAULT
        );
      }

      return;
    }

    this.platform.log.info(
      "[%s] Temperature: %s°C, Humidity: %s%, Battery %s%",
      this.accessory.displayName,
      temperature,
      humidity,
      battery
    );

    this.thermometer.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      temperature
    );

    this.hygrometer.updateCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      humidity
    );

    this.battery.updateCharacteristic(
      this.platform.Characteristic.BatteryLevel,
      battery
    );

    this.history.addEntry({
      time: Math.round(new Date().valueOf() / 1000),
      temp: temperature,
      humidity: humidity,
    });

    for (const service of [this.thermometer, this.hygrometer]) {
      service.updateCharacteristic(
        this.platform.Characteristic.StatusFault,
        this.platform.Characteristic.StatusFault.NO_FAULT
      );
    }

    for (const service of [this.thermometer, this.hygrometer, this.battery]) {
      service.updateCharacteristic(
        this.platform.Characteristic.StatusLowBattery,
        battery <= LOW_BATTERY
          ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
    }
  }
}
