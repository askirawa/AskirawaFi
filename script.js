document.addEventListener("DOMContentLoaded", () => {

  const treasury = document.getElementById("treasury");
  const transactions = document.getElementById("transactions");
  const uptime = document.getElementById("uptime");

  function animate(element, start, end, duration, prefix = "", suffix = "") {
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const value = Math.floor(progress * (end - start) + start);

      element.innerHTML = prefix + value.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  animate(treasury, 0, 245000, 1800, "$");
  animate(transactions, 0, 128, 1800);
  animate(uptime, 0, 99, 1800, "", "%");

});
