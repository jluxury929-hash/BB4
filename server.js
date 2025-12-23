/**
 * 🔱 APEX v38.9.17 - THE TITAN UNIVERSAL (DYNAMIC SCALING)
 * Strategy: Dynamic Simulation-First Flash Arbitrage
 * Target: 0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0
 */

const { ethers, Wallet, WebSocketProvider } = require('ethers');

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WSS_URL: "wss://base-mainnet.g.alchemy.com/v2/G-WBAMA8JxJMjkc-BCeoK",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    MIN_PROFIT_BUFFER: "0.005", 
    GAS_LIMIT: 950000n // Increased buffer for larger 100 ETH strikes
};

async function startTitanBot() {
    const provider = new WebSocketProvider(CONFIG.WSS_URL);
    const signer = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);

    console.log(`\n🔱 TITAN UNIVERSAL DYNAMIC ARMED`);
    console.log(`Target Contract: ${CONFIG.TARGET_CONTRACT}`);

    let scanCount = 0;

    provider.on("pending", async (txHash) => {
        try {
            scanCount++;
            if (scanCount % 50 === 0) process.stdout.write(".");

            // 1. DYNAMIC LOAN CALCULATION
            // Check balance to determine strike size
            const balanceWei = await provider.getBalance(signer.address);
            const balanceEth = parseFloat(ethers.formatEther(balanceWei));
            const ethPrice = 3300; // Estimated Base price for scaling
            const usdValue = balanceEth * ethPrice;

            let currentLoanAmount;
            if (usdValue >= 200) currentLoanAmount = ethers.parseEther("100");
            else if (usdValue >= 100) currentLoanAmount = ethers.parseEther("75");
            else if (usdValue >= 75)  currentLoanAmount = ethers.parseEther("50");
            else if (usdValue >= 30)  currentLoanAmount = ethers.parseEther("25");
            else currentLoanAmount = ethers.parseEther("10"); // Minimum floor

            const feeData = await provider.getFeeData();
            const simulationData = encodeTitanCall(currentLoanAmount); 
            
            // 2. SIMULATE
            const rawProfit = await provider.call({
                to: CONFIG.TARGET_CONTRACT,
                data: simulationData,
                from: signer.address
            });

            // 3. CALCULATE OVERHEAD
            const netValue = BigInt(rawProfit);
            const gasCost = CONFIG.GAS_LIMIT * (feeData.maxFeePerGas || feeData.gasPrice);
            const aaveFee = (currentLoanAmount * 5n) / 10000n; // 0.05% Aave V3 Fee
            const totalOverhead = gasCost + aaveFee + ethers.parseEther(CONFIG.MIN_PROFIT_BUFFER);

            // 4. EXECUTE STRIKE
            if (netValue > totalOverhead) {
                const cleanProfit = ethers.formatEther(netValue - gasCost - aaveFee);
                console.log(`\n\n💎 [DYNAMIC STRIKE] Amount: ${ethers.formatEther(currentLoanAmount)} ETH`);
                console.log(`💰 Est. Net Profit: ${cleanProfit} ETH`);
                
                const tx = await signer.sendTransaction({
                    to: CONFIG.TARGET_CONTRACT,
                    data: simulationData,
                    gasLimit: CONFIG.GAS_LIMIT,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                    maxFeePerGas: feeData.maxFeePerGas,
                    type: 2
                });
                console.log(`🚀 BROADCASTED: ${tx.hash}`);
                await tx.wait();
            }
        } catch (e) {
            // Reverts are ignored to keep the loop fast
        }
    });
}

function encodeTitanCall(amount) {
    const iface = new ethers.Interface(["function requestTitanLoan(address,uint256,address[])"]);
    return iface.encodeFunctionData("requestTitanLoan", [
        CONFIG.WETH, 
        amount, 
        [CONFIG.WETH, CONFIG.USDC]
    ]);
}

startTitanBot().catch(console.error);
