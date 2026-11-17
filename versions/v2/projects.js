const filters = document.querySelectorAll(".filter-button");
const projectCards = document.querySelectorAll(".project-detail-card");
const projectCount = document.getElementById("project-count");
const emptyState = document.getElementById("empty-state");

function showProjects(category) {
  let visibleCount = 0;

  projectCards.forEach((card) => {
    const categories = card.dataset.category.split(" ");
    const isVisible = category === "all" || categories.includes(category);
    card.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  filters.forEach((filter) => {
    const isSelected = filter.dataset.filter === category;
    filter.classList.toggle("is-active", isSelected);
    filter.setAttribute("aria-pressed", String(isSelected));
  });

  projectCount.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? "project" : "projects"}`;
  emptyState.hidden = visibleCount > 0;
}

filters.forEach((filter) => {
  filter.addEventListener("click", () => showProjects(filter.dataset.filter));
});
