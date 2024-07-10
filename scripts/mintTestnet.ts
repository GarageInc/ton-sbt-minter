import { Address, beginCell, toNano } from '@ton/core';
import { createCollectionMintMessage, NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';
import { KeyPair, mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { encodeOffChainContent } from '../utils/nftContent';
import { randomAddress } from '@ton/test-utils';

export async function run(provider: NetworkProvider) {
    let owner = Address.parse('0QAaTi50BvnsSAGLiE2-oxSEzzEnw14kSupVCsFayQrLuJXW')
    let keyPair: KeyPair = {
        secretKey: Buffer.from('9368a03a7889aff356559932445fa2457ee28211a6915062b66382ac646a37291969614880b3c6e58108eeee3c51ee1582dabe565b700cbe8bb5a65d4d5e2728', 'hex'),
        publicKey: Buffer.from('1969614880b3c6e58108eeee3c51ee1582dabe565b700cbe8bb5a65d4d5e2728', 'hex')
    }

    let msg = createCollectionMintMessage({
        // How much commission collection takes
        commissionAmount: toNano('0.1'),
        // How much is used to deploy the nft (0.05 is a standard value)
        nftForwardAmount: toNano('0.05'),
        secretKey: keyPair.secretKey,
        // address of the owner of NFT
        nftOwner: owner,
        // address of the editor of the NFT
        nftEditor: owner,
        // tail part of the NFT metadata json url, common part is stored in collection
        nftContent: 'nft.json',
    })
    let nftCollection = provider.open(NftCollection.createFromAddress(Address.parse('EQAOV51odcNIwNjD9iOBMHutNzqXHBXgMamLaW5hsmafrPyF')))

    let res = await nftCollection.sendUserMint(
        provider.sender(),
        msg.message
    )
}
