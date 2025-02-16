const margin = { top: 30, right: 20, bottom: 20, left: 35 }; // Increased left margin further
const width = 960 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

const tooltip = d3.select("#tooltip");

// Load baby names data
d3.csv("../data/baby_names.csv").then(data => {
    console.log("Baby Names Data Loaded:", data);

    // Process baby names data: aggregate counts by name
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

    let nameCountArray = Array.from(nameCountMap, ([name, count]) => ({ name, count }));
    nameCountArray.sort((a, b) => b.count - a.count);
    let top10Names = nameCountArray.slice(0, 10);
    console.log("Top 10 Baby Names:", top10Names);

    // Set up the bar chart scales
    const xScale = d3.scaleBand()
        .domain(top10Names.map(d => d.name))
        .range([50, width-50])
        .padding(0.4);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(top10Names, d => d.count)* 1.2])
        .range([height-50, 50]);


    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - 50})`)
        .call(d3.axisBottom(xScale).tickSize(0)) // Remove tick marks on x-axis
        .selectAll(".tick text")
        .style("text-anchor", "middle") // Center the labels
        .style("font-size", "12px");

    // Add y-axis
    svg.append("g")
        .attr("transform", `translate(50, 0)`)
        .call(d3.axisLeft(yScale)
            .tickSizeOuter(0)) // Remove outer tick marks on y-axis
        .selectAll(".tick text")
        .style("font-size", "12px");

    // Add title to the chart
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Top 10 Baby Names in the US (2006-2015)");

    // Add axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Baby Names");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Count");


    // Function to initialize Bootstrap tooltips
    function initializeTooltips() {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
    // Create bars for the bar chart
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // You can choose any color scheme

    svg.selectAll(".bar")
        .data(top10Names)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.name))
        .attr("y", d => yScale(d.count))
        .attr("width", xScale.bandwidth())
        .attr("height", d => height - 50 - yScale(d.count)) // Height of the bar
        .attr("fill", (d, i) => colorScale(i))
        .on("mouseover", function(event, d) {
            const barColor = d3.select(this).attr("fill"); // Get the color from the bar
            tooltip.style("display", "block")
                .html(`<strong>${d.name}:</strong> ${d.count}`)
                .style("left", (xScale(d.name) + xScale.bandwidth() / 2) + "px")
                .style("top", (yScale(d.count) - 40) + "px")
                .style("background-color", barColor)  
                .style("color", "white")               
                .style("border", `2px solid ${barColor}`); 
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX - 50) + "px")
                .style("top", (event.pageY - 50) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
        });

    // Initialize Bootstrap tooltips
    initializeTooltips();
});

