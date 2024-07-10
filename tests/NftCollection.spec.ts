import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { createCollectionMintMessage, NftCollection } from '../wrappers/NftCollection';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { randomAddress } from '@ton/test-utils';
import { decodeOffChainContent, encodeOffChainContent } from '../utils/nftContent';
import { KeyPair, keyPairFromSeed, mnemonicNew, mnemonicToSeed, mnemonicToWalletKey } from '@ton/crypto';
import { NftItem } from '../wrappers/NftItem';

describe('NftCollection', () => {
    let code: Cell;
    let nftItemCode: Cell
    let sbtItemCode: Cell


    beforeAll(async () => {
        code = await compile('NftCollection');
        nftItemCode = await compile('NftItem');
        sbtItemCode = await compile('SbtItem');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let nftCollection: SandboxContract<NftCollection>;
    let keyPair: KeyPair

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        owner = await blockchain.treasury('owner');

        keyPair = await mnemonicToWalletKey(await mnemonicNew())

        nftCollection = blockchain.openContract(NftCollection.createFromConfig({
            owner: owner.address,
            keyPair,
            // nextItemIndex: 0n,
            collectionContent: encodeOffChainContent('https://example.com/metadata.json').endCell(),
            commonContent: beginCell().storeStringTail('https://example.com/').endCell(),
            nftCode: sbtItemCode,
            royaltyParams: {
                factor: 0,
                base: 0,
                address: owner.address
            }
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await nftCollection.sendDeploy(deployer.getSender(), toNano('10'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nftCollection are ready to use
    });

    it('should return collection metadata', async () => {
        let res = await nftCollection.getCollectionData()

        expect(res.minted).toEqual(-1)
        expect(decodeOffChainContent(res.metadata)).toEqual('https://example.com/metadata.json')
        expect(res.owner.equals(owner.address)).toBe(true)
    })

    it('should mint from admin', async () => {
        let res = await nftCollection.sendMint(owner.getSender(), {
            nftIndex: 0n,
            nftTransferAmount: toNano('0.1'),
            nftContent: beginCell().endCell()
        })

        let nftAddress = await nftCollection.getNftAddress(0n)

        // Should deploy new nft
        expect(res.transactions).toHaveTransaction({
            deploy: true,
            from: nftCollection.address,
            to: nftAddress
        })
    })

    it('should mint from user', async () => {
        let nftOwner = randomAddress()

        let msg = createCollectionMintMessage({
            commissionAmount: toNano('0.1'),
            nftForwardAmount: toNano('0.1'),
            secretKey: keyPair.secretKey,
            nftOwner: nftOwner,
            nftEditor: owner.address,
            nftContent: 'nft.json',
        })
        let res = await nftCollection.sendUserMint(owner.getSender(), msg.message)


        let nftAddress = await nftCollection.getNftAddress(msg.nftIndex)

        // Should deploy new nft
        expect(res.transactions).toHaveTransaction({
            deploy: true,
            from: nftCollection.address,
            to: nftAddress
        })

        let nft = blockchain.openContract(NftItem.createFromAddress(nftAddress))

        let nftContent = await nft.getData()

        expect(nftContent.initialized).toEqual(true)
        expect(nftContent.collectionAddress.equals(nftCollection.address)).toBe(true)
        expect(nftContent.index).toEqual(msg.nftIndex)
        expect(nftContent.ownerAddress.equals(nftOwner)).toEqual(true)

        let nftMetadata = await nftCollection.getNftContent(msg.nftIndex, nftContent.content)

        expect(nftMetadata).toEqual('https://example.com/nft.json')
    })

    it('should update owner', async () => {

        let newOwner = await blockchain.treasury('owner2')
        await nftCollection.sendUpdateOwner(owner.getSender(), newOwner.address)

        let res = await nftCollection.sendMint(newOwner.getSender(), {
            nftIndex: 0n,
            nftTransferAmount: toNano('0.1'),
            nftContent: beginCell().endCell()
        })

        let nftAddress = await nftCollection.getNftAddress(0n)

        // Should deploy new nft
        expect(res.transactions).toHaveTransaction({
            deploy: true,
            from: nftCollection.address,
            to: nftAddress
        })
    })

    it('should update content', async () => {

        let royaltyAddr = randomAddress()
        await nftCollection.sendUpdateContent(owner.getSender(), {
            content: {
                collectionContent: encodeOffChainContent('https://example2.com/metadata.json').endCell(),
                commonContent: beginCell().storeStringTail('https://example2.com/').endCell(),
            },
            royaltyParams: {
                factor: 1,
                base: 2,
                address: royaltyAddr
            }
        })


        let metadata = await nftCollection.getCollectionData()

        expect(decodeOffChainContent(metadata.metadata)).toEqual('https://example2.com/metadata.json')
    })

    it('should collect fees', async () => {
        let res = await nftCollection.sendCollectFees(owner.getSender())

        expect(res.transactions).toHaveTransaction({
            from: nftCollection.address,
            to: owner.address,
            value: (v) => v! > toNano('9')
        })
    })
});
