import noble from "@abandonware/noble";

export type ThermoBeaconOriaReading = {
  temperature?: number;
  humidity?: number;
  battery?: number;
};

type Offset = [Offset: number, ByteLength: number];

const SCAN_TIMEOUT = 2000;
const MSG_LENGTH = 20;

const BATTERY: Offset = [10, 2];
const TEMPERATURE: Offset = [12, 2];
const HUMIDITY: Offset = [14, 2];

let driverPromise: Promise<void> | null = null;
let scanPromise: Promise<void> | null = null;

const callbacks: Map<string, (buffer: Buffer) => void> = new Map();

noble.on("discover", async (peripheral) => {
  const callback = callbacks.get(peripheral.address.toUpperCase());

  if (callback) {
    callback(peripheral.advertisement.manufacturerData);
  }
});

function initDriver() {
  if (!driverPromise) {
    driverPromise = new Promise((resolve) => {
      noble.on("stateChange", (state) => {
        if (state === "poweredOn") {
          resolve();
        }
      });
    });
  }

  return driverPromise;
}

async function startScanning() {
  await initDriver();

  if (!scanPromise) {
    scanPromise = noble.startScanningAsync();
  }

  return scanPromise;
}

async function stopScanning() {
  if (callbacks.size <= 0) {
    await noble.stopScanningAsync();

    scanPromise = null;
  }
}

export async function read(macAddr: string): Promise<ThermoBeaconOriaReading> {
  await startScanning();

  return new Promise((_resolve) => {
    const timer = setTimeout(resolve, SCAN_TIMEOUT);

    async function resolve(data: ThermoBeaconOriaReading = {}) {
      clearTimeout(timer);
      callbacks.delete(macAddr.toUpperCase());
      await stopScanning();

      return _resolve(data);
    }

    async function callback(buf: Buffer) {
      if (buf.byteLength === MSG_LENGTH) {
        const temperature = buf.readIntLE(...TEMPERATURE) / 16;
        const humidity = buf.readIntLE(...HUMIDITY) / 16;
        const battery = (buf.readIntLE(...BATTERY) * 100) / 3400;

        return resolve({
          temperature,
          humidity,
          battery,
        });
      }

      return resolve();
    }

    callbacks.set(macAddr.toUpperCase(), callback);
  });
}
