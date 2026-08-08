// AskirawaFi Treasury Dashboard
// Interactive frontend logic

const treasury = {
  balance: 245000,
  transactions: 128,
  reliability: 99.99
};

function formatUSDC(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(amount);
}

function updateTreasury() {
  const balanceElement = document.getElementById("treasuryBalance");
  const transactionsElement = document.getElementById("transactionCount");
  const reliabilityElement = document.getElementById("reliability");

  if (balanceElement) {
    balanceElement.textContent = formatUSDC(treasury.balance);
  }

  if (transactionsElement) {
    transactionsElement.textContent = treasury.transactions;
  }

  if (reliabilityElement) {
    reliabilityElement.textContent = `${treasury.reliability}%`;
  }
}

function simulateTransaction() {
  const amount = 1000;

  if (treasury.balance < amount) {
    alert("Insufficient treasury balance.");
    return;
  }

  treasury.balance -= amount;
  treasury.transactions += 1;

  updateTreasury();

  alert(
    `Transaction simulated successfully.\n\n${formatUSDC(
      amount
    )} USDC processed through AskirawaFi.`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  updateTreasury();

  const transactionButton =
    document.getElementById("simulateTransaction");

  if (transactionButton) {
    transactionButton.addEventListener(
      "click",
      simulateTransaction
    );
  }
});
