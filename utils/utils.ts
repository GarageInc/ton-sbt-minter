import path from "path";
import os from "os";
import {unlink, writeFile} from "fs/promises";
import {execSync} from "child_process";
import fs from "fs";
import * as BN from "bn.js";
import {createHash, pseudoRandomBytes} from "crypto";
import {Address} from "@ton/ton";

export async function createTempFile(ext: string) {
    let name = (Math.random()).toString(16).replace('.', '')
    let fullPath = path.resolve(os.tmpdir(), name + ext)
    await writeFile(fullPath, Buffer.alloc(0))

    return {
        name: fullPath,
        destroy: async () => {
            await unlink(fullPath)
        }
    }
}

export function executeFunc(args: string[]) {
    execSync(__dirname + '/../../bin/func' + ' ' + args.join(' '), {
        stdio: 'inherit'
    });
}

export async function readFile(name: string) {
    return await new Promise<string>((resolve, reject) => {
        fs.readFile(name, 'utf-8', (e, d) => {
            if (e) {
                reject(e);
            } else {
                resolve(d);
            }
        });
    })
}

export async function compileFunc(source: string): Promise<string> {
    // let sourceFile = await createTempFile('.fc');
    let fiftFile = await createTempFile('.fif');
    let funcLib = path.resolve(__dirname, '..', 'funclib', 'stdlib.fc');
    try {
        // await writeFile(sourceFile.name, source);
        executeFunc(['-PS', '-o', fiftFile.name, source]);
        let fiftContent = await readFile(fiftFile.name);
        // console.log(fiftContent)
        fiftContent = fiftContent.slice(fiftContent.indexOf('\n') + 1); // Remove first line
        return fiftContent;
    } finally {
        // await sourceFile.destroy();
        await fiftFile.destroy();
    }
}

export const sha256ToNumStr = (src: string) => {
    return (new BN.BN(createHash('sha256').update(src).digest())).toString(10)
}

export const sha256ToBN = (src: string) => {
    return (new BN.BN(createHash('sha256').update(src).digest()))
}
export const sha256ToBigint = (src: string) => {
    // console.log( createHash('sha256').update(src).digest().toString('hex'))
    // console.log(BigInt('0x' + createHash('sha256').update(src).digest().toString('hex')).toString(16))
    return BigInt('0x' + createHash('sha256').update(src).digest().toString('hex'))
}

export function randomAddress() {
    return new Address(0, pseudoRandomBytes(256 / 8))
}