import {Cell} from "@ton/core";
import {sha256ToNumStr} from "./utils";
import {beginCell, Builder, Dictionary, DictionaryValue, Slice} from "@ton/ton";

const OFF_CHAIN_CONTENT_PREFIX = 0x01
const ON_CHAIN_CONTENT_PREFIX = 0x00
const SNAKE_PREFIX = 0x00

export function flattenSnakeCell(cell: Cell) {
    let c: Cell|null = cell

    let res = Buffer.alloc(0)

    while (c) {
        let cs = c.beginParse()
        // let data = cs.readRemainingBytes()
        let data = cs.loadBuffer(cs.remainingBits/8)
        res = Buffer.concat([res, data])
        c = c.refs[0]
    }

    return res
}


function bufferToChunks(buff: Buffer, chunkSize: number) {
    let chunks: Buffer[] = []
    while (buff.byteLength > 0) {
        chunks.push(buff.slice(0, chunkSize))
        buff = buff.slice(chunkSize)
    }
    return chunks
}

export function makeSnakeCell(data: Buffer) {
    let chunks = bufferToChunks(data, 127)
    let rootCell = beginCell()
    let curCell = rootCell

    let refs = []

    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i]

        curCell.storeBuffer(chunk)

        if (chunks[i+1]) {
            let nextCell = beginCell()
            refs.push(nextCell)
            curCell = nextCell
        }
    }

    if (refs.length > 0) {
        let prev: Builder|null = null
        while (refs.length > 0) {
            let c = refs.pop()!
            if (prev) {
                c.storeRef(prev)
            }
            prev = c
        }
        rootCell.storeRef(prev!)
    }

    return rootCell
}

export function encodeOffChainContent(content: string) {
    let data = Buffer.from(content)
    let offChainPrefix = Buffer.from([OFF_CHAIN_CONTENT_PREFIX])
    data = Buffer.concat([offChainPrefix, data])
    return makeSnakeCell(data)
}

export function decodeOffChainContent(content: Cell) {
    let data = flattenSnakeCell(content)

    let prefix = data[0]
    if (prefix !== OFF_CHAIN_CONTENT_PREFIX) {
        throw new Error(`Unknown content prefix: ${prefix.toString(16)}`)
    }
    return data.slice(1).toString()
}

export function encodeTextSnake(text: string) {
    let data = Buffer.from(text)
    let snakePrefix = Buffer.from([SNAKE_PREFIX])
    return makeSnakeCell(Buffer.concat([snakePrefix, data]))
}

// tail#_ {bn:#} b:(bits bn) = SnakeData ~0;
// cons#_ {bn:#} {n:#} b:(bits bn) next:^(SnakeData ~n) = SnakeData ~(n + 1);
// chunked_data#_ data:(HashMapE 32 ^(SnakeData ~0)) = ChunkedData;

// text#_ {n:#} data:(SnakeData ~n) = Text;
// snake#00 data:(SnakeData ~n) = ContentData;
// chunks#01 data:ChunkedData = ContentData;
// onchain#00 data:(HashMapE 256 ^ContentData) = FullContent;
// offchain#01 uri:Text = FullContent;

export function decodeContentData(content: Cell) {
    let ds = content.beginParse()
    let prefix = ds.loadUint(8)

    if (prefix === 0x0) {
        return flattenSnakeCell(ds.asCell())
    } else if (prefix === 0x01) {
        // let chunks = ds.readDict(32, (s) => s.readCell())
        let chunks = ds.loadDict(Dictionary.Keys.Uint(32), Dictionary.Values.Cell())
        let data = Buffer.alloc(0)

        let keys = chunks.keys().sort((a, b) => a - b)

        for (let key of keys) {
            let value = chunks.get(key)!.beginParse()
            data = Buffer.concat([data, value!.loadBuffer(value.remainingBits/8)])
        }
        // let values = [...chunks.entries()].sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        //
        // for (let [key, value] of values) {
        //     data = Buffer.concat([data, value.beginParse().readRemainingBytes()])
        // }

        return data
    } else {
        throw new Error('Unknown content data')
    }
}

export class OnChainContent {
    constructor(private map: Map<string, Buffer>) {
    }

    getString(key: string) {
        let value = this.map.get(sha256ToNumStr(key))
        if (!value) {
            return null
        }

        return value.toString()
    }

    static decode(content: Cell) {
        throw new Error()
        // return new OnChainContent(decodeOnChainContent(content))
    }
}

function createContentDataValue(): DictionaryValue<Buffer> {
    return {
        serialize: (src, buidler) => {
            // buidler.storeSlice(src)
            throw new Error()
        },
        parse: (src) => {
            return decodeContentData(src.loadRef())
            // return src.loadIntBig(bits);
        }
    }
}

export function decodeOnChainContent(content: Cell) {
    let ds = content.beginParse()

    let prefix = ds.loadUint(8)

    if (prefix !== ON_CHAIN_CONTENT_PREFIX) {
        throw new Error(`Unknown content prefix: ${prefix}`)
    }

    // return ds.readDict(256, (s) => decodeContentData(s.readCell()))
    return ds.loadDict(Dictionary.Keys.BigUint(256), createContentDataValue())
}

// export function decodeTokenContent(content: Cell) {
//     let prefix = content.bits.buffer.readInt8(0)
//
//     if (prefix === ON_CHAIN_CONTENT_PREFIX) {
//         return decodeOnChainContent(content)
//     } else if (prefix === OFF_CHAIN_CONTENT_PREFIX) {
//         return decodeOffChainContent(content)
//     } else {
//         throw new Error('Unknown content prefix: ' + prefix)
//     }
// }