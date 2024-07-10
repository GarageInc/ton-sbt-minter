import { Address, beginCell, toNano } from '@ton/core';
import { createCollectionMintMessage, NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    let nftCollection = provider.open(NftCollection.createFromAddress(Address.parse('kQCHUT_9HafdhaHspRhFFRbGxtlrEPCPEHWV9zfvQiAHTz2r')))

    await nftCollection.sendCollectFees(provider.sender())
}
