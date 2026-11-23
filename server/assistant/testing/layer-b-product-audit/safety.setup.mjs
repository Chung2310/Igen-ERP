import { vi } from 'vitest';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import mongoose from 'mongoose';

vi.mock('dotenv/config', () => ({}));

const safety = { violations: [] };
globalThis.__layerBProductSafety = safety;
const forbidden = kind => (..._args) => {
  safety.violations.push(kind);
  throw new Error(`LAYER_B_FORBIDDEN_IO: ${kind}`);
};

// Guard lower-level transports too: replacing global fetch alone is insufficient.
vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(forbidden('net.Socket.connect'));
vi.spyOn(net.Server.prototype, 'listen').mockImplementation(forbidden('net.Server.listen'));
vi.spyOn(net, 'connect').mockImplementation(forbidden('net.connect'));
vi.spyOn(tls, 'connect').mockImplementation(forbidden('tls.connect'));
vi.spyOn(http, 'request').mockImplementation(forbidden('http.request'));
vi.spyOn(http, 'get').mockImplementation(forbidden('http.get'));
vi.spyOn(https, 'request').mockImplementation(forbidden('https.request'));
vi.spyOn(https, 'get').mockImplementation(forbidden('https.get'));
vi.spyOn(dgram, 'createSocket').mockImplementation(forbidden('dgram.createSocket'));
vi.spyOn(mongoose, 'connect').mockImplementation(forbidden('mongoose.connect'));
vi.spyOn(mongoose, 'createConnection').mockImplementation(forbidden('mongoose.createConnection'));
vi.spyOn(mongoose.Connection.prototype, 'openUri').mockImplementation(forbidden('mongoose.openUri'));
for (const method of ['find', 'findOne', 'create', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate', 'countDocuments', 'bulkWrite']) {
  vi.spyOn(mongoose.Model, method).mockImplementation(forbidden(`mongoose.Model.${method}`));
}
vi.stubGlobal('fetch', forbidden('unmocked fetch'));
