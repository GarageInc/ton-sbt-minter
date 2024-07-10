import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider, crc32c,
    Sender,
    SendMode,
    toNano
} from '@ton/core';
import { decodeOffChainContent, decodeOnChainContent } from '../utils/nftContent';
import { sha256ToBigint } from '../utils/utils';
import { KeyPair, sign } from '@ton/crypto';
import { randomBytes } from 'node:crypto';
import { crc32str } from '../utils/crc32';

export type NftCollectionConfig = {
    owner: Address
    // nextItemIndex: bigint
    collectionContent: Cell
    commonContent: Cell
    nftCode: Cell
    keyPair: KeyPair
    royaltyParams: {
        factor: number
        base: number
        address: Address
    }
};

export function nftCollectionConfigToCell(config: NftCollectionConfig): Cell {
    return beginCell()
        .storeAddress(config.owner)
        .storeBuffer(config.keyPair.publicKey)
        // .storeUint(config.nextItemIndex, 64)
        .storeRef(
            beginCell()
                .storeRef(config.collectionContent)
                .storeRef(config.commonContent)
        )
        .storeRef(config.nftCode)
        .storeRef(
            beginCell()
                .storeUint(config.royaltyParams.factor, 16)
                .storeUint(config.royaltyParams.base, 16)
                .storeAddress(config.royaltyParams.address)
        )
        .endCell();
}

export class NftCollection implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
    }

    static createFromAddress(address: Address) {
        return new NftCollection(address);
    }

    static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
        const data = nftCollectionConfigToCell(config);
        const init = { code, data };
        return new NftCollection(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }

    async getCollectionData(provider: ContractProvider) {
        let res = await provider.get('get_collection_data', []);
        return {
            minted: res.stack.readNumber(),
            metadata: res.stack.readCell(),
            owner: res.stack.readAddress()
        };
    }

    async getNftContent(provider: ContractProvider, index: bigint, nftData: Cell) {
        let res = await provider.get('get_nft_content', [
            { type: 'int', value: index },
            { type: 'cell', cell: nftData }
        ]);

        return decodeOffChainContent(res.stack.readCell());
    }

    async sendMint(provider: ContractProvider, via: Sender, opts: {
        nftIndex: bigint,
        nftTransferAmount: bigint,
        nftContent: Cell
    }) {
        await provider.internal(via, {
            value: toNano(0.5),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(crc32str('op::mint'), 32)
                .storeUint(0, 64)
                .storeUint(opts.nftIndex, 128)
                .storeCoins(opts.nftTransferAmount)
                .storeRef(opts.nftContent)
                .endCell()
        });
    }

    async sendUserMint(provider: ContractProvider, via: Sender, mintMessage: Cell) {
        await provider.internal(via, {
            value: toNano('0.5'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: mintMessage
        });
    }

    async getNftAddress(provider: ContractProvider, nftIndex: bigint) {
        let res = await provider.get('get_nft_address_by_index', [
            { type: 'int', value: nftIndex }
        ]);

        return res.stack.readAddress();
    }

    async sendUpdateOwner(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            value: toNano(0.5),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(crc32str('op::update_owner'), 32)
                .storeUint(0, 64)
                .storeAddress(newOwner)
                .endCell()
        });
    }


    async sendUpdateContent(provider: ContractProvider, via: Sender, opts: {
        content: {
            collectionContent: Cell,
            commonContent: Cell
        },
        royaltyParams: {
            factor: number
            base: number
            address: Address
        }
    }) {
        await provider.internal(via, {
            value: toNano(0.5),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(crc32str('op::update_content'), 32)
                .storeUint(0, 64)
                .storeRef(
                    beginCell()
                        .storeRef(opts.content.collectionContent)
                        .storeRef(opts.content.commonContent)
                )
                .storeRef(
                    beginCell()
                        .storeUint(opts.royaltyParams.factor, 16)
                        .storeUint(opts.royaltyParams.base, 16)
                        .storeAddress(opts.royaltyParams.address)
                )
                .endCell()
        });
    }

    async sendCollectFees(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano(0.5),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(crc32str('op::collect_fees'), 32)
                .storeUint(0, 64)
                .endCell()
        });
    }


}


export function createCollectionMintMessage(opts: {
    commissionAmount: bigint,
    nftForwardAmount: bigint,
    secretKey: Buffer,
    nftOwner: Address,
    nftEditor: Address
    nftContent: string
}) {
    let validUntil = Math.floor(Date.now() / 1e3) + 60; // 60s
    let nftIndex = BigInt('0x' + randomBytes(16).toString('hex')); // random 128bit uint

    let signingMessage = beginCell()
        .storeUint(validUntil, 32)
        .storeUint(nftIndex, 128)
        .storeCoins(opts.commissionAmount)
        .storeCoins(opts.nftForwardAmount)
        .storeRef(
            beginCell()
            .storeAddress(opts.nftOwner)
            .storeRef(beginCell().storeStringTail(opts.nftContent))
            .storeAddress(opts.nftEditor)
            .endCell()
        );

    let signature = sign(signingMessage.endCell().hash(), opts.secretKey);

    return {
        message: beginCell()
            .storeUint(crc32str('op::user_mint'), 32)
            .storeUint(0, 64)
            .storeBuffer(signature)
            .storeBuilder(signingMessage)
            .endCell(),
        nftIndex
    };
}
