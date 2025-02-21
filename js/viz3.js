const width = 960, height = 600;
const svg = d3.select("svg");
const tooltip = d3.select("#tooltip");

// Main function to load data and draw the chart
function loadData() {
    Promise.all([
        d3.csv("../data/baby_names.csv"),
        d3.json("../data/states.geojson")
    ]).then(([babyNamesData, geoData]) => {
        processBabyNamesData(babyNamesData);
        drawBarChart(babyNamesData);
    });
}

// Function to process baby names data and get top 10 names
function processBabyNamesData(data) {
    let nameCountMap = new Map();
    data.forEach(d => {
        let name = d.Name;
        let count = +d.Count;

        if (nameCountMap.has(name)) {
            nameCountMap.set(name, nameCountMap.get(name) + count);
        } else {
            nameCountMap.set(name, count);
        }
    });

    // Sort the data and get top 10 names
    let nameCountArray = Array.from(nameCountMap, ([name, count]) => ({ name, count }));
    nameCountArray.sort((a, b) => b.count - a.count);
    return nameCountArray.slice(0, 10); // Return the top 10 names
}

// Function to draw the bar chart
function drawBarChart(data) {
    const top10Names = processBabyNamesData(data);

    // Set up the scales for the bar chart
    const xScale = d3.scaleBand()
        .domain(top10Names.map(d => d.name))
        .range([80, width - 50])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(top10Names, d => d.count) * 1.2])
        .range([height - 50, 50]);

    // Add axes using a separate function
    addAxes(xScale, yScale, top10Names);

    // Add axis labels
    addAxisLabels();

    // Draw the pattern for the bars in a separate function
    const pattern = drawBarPattern();

    // Draw the bars
    drawBars(top10Names, xScale, yScale, pattern);
}

// Function to add x and y axes
function addAxes(xScale, yScale, top10Names) {
    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - 50})`)
        .call(d3.axisBottom(xScale).tickSize(0)) // Remove tick marks on x-axis
        .selectAll(".tick text")
        .style("text-anchor", "middle").style("font-size", "14px").style("font-weight", "bold");

    // Add y-axis
    svg.append("g")
        .attr("transform", `translate(80, 0)`)
        .call(d3.axisLeft(yScale).tickSizeOuter(0)) // Remove outer tick marks on y-axis
        .selectAll(".tick text")
        .style("font-size", "14px").style("font-weight", "bold");
}

// Function to add axis labels
function addAxisLabels() {
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "18px").style("font-weight", "bold").text("Baby Names");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 15)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px").style("font-weight", "bold").text("Count");
}

// Function to draw the bar pattern
function drawBarPattern() {
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "stripePattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 30)
        .attr("height", 15);

    pattern.append("rect")
        .attr("width", 30)
        .attr("height", 15)
        .attr("fill", "#ffc107");

    pattern.append("path")
        .attr("d", "M 0,15 L 30,15")
        .attr("stroke", "#ffe8a4")
        .attr("stroke-width", 2);

    return pattern;
}

// Function to draw bars on the chart
function drawBars(top10Names, xScale, yScale, pattern) {
    svg.selectAll(".bar")
        .data(top10Names)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.name))
        .attr("y", d => yScale(d.count))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - 50 - yScale(d.count))
        .attr("fill", "url(#stripePattern)")
        .attr("stroke", "black")
        .attr("stroke-width", 1.5)
        .on("mouseover", function (event, d) {
            showTooltip(event, d);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

// Function to show tooltip
function showTooltip(event, d) {
    tooltip.style("display", "block").html(`<strong>${d.name}:</strong> ${d.count}`);
    moveTooltip(event);
}

// Function to move tooltip with mouse
function moveTooltip(event) {
    tooltip.style("left", (event.pageX - 50) + "px").style("top", (event.pageY - 50) + "px");
}

// Function to hide tooltip
function hideTooltip() {
    tooltip.style("display", "none");
}

// Call the main function to load data and render the chart
loadData();
