
const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select(".tooltip");

let babyNamesData = new Map();

// Load baby names data (Only for Year 2006)
d3.csv("baby_names.csv").then(data => {
    let filteredData = data.filter(d => +d.Year === 2006); // Filter only 2006

    filteredData.forEach(d => {
        let state = d.STUSPS;
        if (!babyNamesData.has(state)) {
            babyNamesData.set(state, []);
        }
        babyNamesData.get(state).push({
            name: d.Name,
            count: +d.Count
        });
    });

    // Sort names per state by count in descending order and keep top 3
    babyNamesData.forEach((names, state) => {
        names.sort((a, b) => b.count - a.count);
        babyNamesData.set(state, names.slice(0, 3));
    });

    console.log("Filtered and Sorted Baby Names Data (2006):", babyNamesData);

    // Load GeoJSON only after data is processed
    d3.json("states.geojson").then(geoData => {
        console.log("GeoJSON Data Loaded:", geoData);

        const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
        const path = d3.geoPath().projection(projection);

        svg.selectAll(".state")
            .data(geoData.features)
            .join("path")
            .attr("class", "state")
            .attr("d", path)
            .attr("fill", "#ccc")
            .on("mouseover", (event, d) => {
                const stateAbbr = d.properties.STUSPS; // Ensure this exists
                if (!stateAbbr) {
                    console.warn("Missing STUSPS in GeoJSON for:", d.properties);
                    return;
                }
                const topNames = babyNamesData.get(stateAbbr) || [];
                console.log(`top names`, topNames);
                const namesText = topNames.map(n => `${n.name} (${n.count})`).join("<br>") || "No Data";
                console.log(`top 3 names`, namesText);
                tooltip.style("display", "block")
                    .html(`<strong>${d.properties.NAME} (${stateAbbr})</strong><br>
                           <strong>Top Baby Names:</strong><br>
                           ${namesText}`)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY + 10}px`);
            })
            .on("mouseout", () => tooltip.style("display", "none"));
    });
});
