const sdk = require('@defillama/sdk');

const { GraphQLClient, gql } = require('graphql-request');

const ethAddress = '0x0000000000000000000000000000000000000000'

const lsd_subgraph = 'https://api.thegraph.com/subgraphs/name/vince0656/lsd-mainnet'

const stakehouse_subgraph = 'https://api.thegraph.com/subgraphs/name/stakehouse-dev/stakehouse-protocol'

async function tvl(_, _1, _2, { api }) {
    let balances = {};
    let query
    let results

    const lsdGraphQLClient = new GraphQLClient(lsd_subgraph)
    const stakehouseGraphQLClient = new GraphQLClient(stakehouse_subgraph)

    // Get the stakehouseAccounts and calculate the total staked ETH (for lifecyclestatus = 2)/minted dETH (for lifecyclestatus = 3)
    query = gql`{
        stakehouseAccounts {
          id
          lifecycleStatus
          totalDETHMinted
        }
    }`

    results = await stakehouseGraphQLClient.request(query)

    let totalETHStakedAndMinted = 0
    for (let i = 0; i < results.stakehouseAccounts.length; i++) {
        if (results.stakehouseAccounts[i].lifecycleStatus === "2")
            totalETHStakedAndMinted += (32) * 10 ** 18
        else if (results.stakehouseAccounts[i].lifecycleStatus === "3")
            totalETHStakedAndMinted += (Number(results.stakehouseAccounts[i].totalDETHMinted) + (8 * 10 ** 18))
    }

    // Get the LP balances for the idle ETH in Protected Staking and the Fees and MEV Pools
    query = gql`{
        lptokens(where:{
          lifecycleStatus: "NOT_STAKED"
        }) {
          tokenType
          lifecycleStatus
          blsPublicKey
          withdrawn
          minted
        }
    }`

    results = await lsdGraphQLClient.request(query)

    let totalIdleETHInPools = 0

    for (let i = 0; i < results.lptokens.length; i++)
        totalIdleETHInPools += (Number(results.lptokens[i].minted) - Number(results.lptokens[i].withdrawn))

    // Get the idle ETH deposited by the validators still in the "WAITING_FOR_ETH" and "READY_TO_STAKE" status
    query = gql`{
        lsdvalidators(where: {
          status_in: ["WAITING_FOR_ETH", "READY_TO_STAKE"]
        }) {
          id
        }
    }`
    results = await lsdGraphQLClient.request(query)

    let totalIdleETHFromValidators = (results.lsdvalidators.length) * 4 * 10 ** 18

    await sdk.util.sumSingleBalance(balances, ethAddress, (totalETHStakedAndMinted + totalIdleETHFromValidators + totalIdleETHInPools), api.chain)
    return balances;
}

module.exports = {
    ethereum: {
        tvl
    }
};