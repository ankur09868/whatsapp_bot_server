import {parentPort, workerData} from 'worker_threads';

console.log(workerData)

const result = workerData.num * workerData.num

parentPort.postMessage(result)