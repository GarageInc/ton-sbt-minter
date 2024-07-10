import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type NftConfig = {};

export function nftConfigToCell(config: NftConfig): Cell {
    return beginCell().endCell();
}

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftConfig, code: Cell, workchain = 0) {
        const data = nftConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getSupportedInterfaces(provider: ContractProvider) {
        let res = await provider.get('supported_interfaces', [])
        return [
            res.stack.readString(),
            res.stack.readString(),
        ]
    }

    async getData(provider: ContractProvider) {
        let res = await provider.get('get_nft_data', [])

        return {
            initialized: res.stack.readBoolean(),
            index: res.stack.readBigNumber(),
            collectionAddress: res.stack.readAddress(),
            ownerAddress: res.stack.readAddress(),
            content: res.stack.readCell(),
        }
    }
}
