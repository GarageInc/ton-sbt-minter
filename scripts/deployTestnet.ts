import { Address, beginCell, toNano } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';
import { KeyPair, mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { encodeOffChainContent } from '../utils/nftContent';




export async function run(provider: NetworkProvider) {
    // Fill the address of the owner of collection
    let owner = Address.parse('0QAaTi50BvnsSAGLiE2-oxSEzzEnw14kSupVCsFayQrLuJXW')
    let mnemonics = await mnemonicNew()
    let keyPair = await mnemonicToWalletKey(mnemonics)

    // KeyPair should be saved after deployment
    console.log('secret key: ', keyPair.secretKey.toString('hex'))
    console.log('public key: ', keyPair.publicKey.toString('hex'))

    const nftCollection = provider.open(NftCollection.createFromConfig({
        owner,
        keyPair,
        // Link to JSON with collection metadata
        collectionContent: encodeOffChainContent('https://cdn-nfts.bazaar.art/nfts/collection.json').endCell(),
        // Link to common part of NFT items metadata
        commonContent: beginCell().storeStringTail('https://cdn-nfts.bazaar.art/nfts/').endCell(),
        nftCode: await compile('SbtItem'),
        royaltyParams: {
            factor: 0,
            base: 0,
            address: owner
        }
    }, await compile('NftCollection')));

    await nftCollection.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(nftCollection.address);

    // run methods on `nftCollection`
}
