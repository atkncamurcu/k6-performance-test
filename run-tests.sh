#!/bin/zsh

# run-tests.sh - Helper script to run K6 performance tests

# Make sure the script is executable
# chmod +x run-tests.sh

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   DummyJSON API Performance Tests      ${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}K6 is not installed. Installing via Homebrew...${NC}"
    brew install k6
    
    if [ $? -ne 0 ]; then
        echo "Failed to install K6. Please install it manually:"
        echo "brew install k6"
        exit 1
    fi
fi

# Create results directory if it doesn't exist
mkdir -p results

# Default test duration
DURATION="30s"
VUS="10"
TEST_FILE="dummyjson-test.js"
OUTPUT_FILE="results/result-$(date +%Y%m%d-%H%M%S).json"

# Function to display help
show_help() {
    echo -e "\n${YELLOW}Usage:${NC}"
    echo -e "  ./run-tests.sh [options]"
    echo -e "\n${YELLOW}Options:${NC}"
    echo -e "  -d, --duration DURATION   Test duration (default: 30s)"
    echo -e "  -u, --vus USERS           Number of virtual users (default: 10)"
    echo -e "  -t, --test FILE           Test script file (default: dummyjson-test.js)"
    echo -e "  -a, --advanced            Run the advanced test script"
    echo -e "  -f, --full                Run the full staged test with the original configuration"
    echo -e "  -h, --help                Show this help message"
    echo -e "\n${YELLOW}Examples:${NC}"
    echo -e "  ./run-tests.sh --duration 1m --vus 20"
    echo -e "  ./run-tests.sh --advanced"
    echo -e "  ./run-tests.sh --full"
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -d|--duration)
        DURATION="$2"
        shift 2
        ;;
        -u|--vus)
        VUS="$2"
        shift 2
        ;;
        -t|--test)
        TEST_FILE="$2"
        shift 2
        ;;
        -a|--advanced)
        TEST_FILE="dummyjson-advanced-test.js"
        shift
        ;;
        -f|--full)
        FULL_TEST=true
        shift
        ;;
        -h|--help)
        show_help
        ;;
        *)
        echo "Unknown option: $1"
        show_help
        ;;
    esac
done

# Run the test
echo -e "\n${GREEN}Running K6 test with the following configuration:${NC}"
if [ "$FULL_TEST" = true ]; then
    echo -e "  Test file: ${TEST_FILE}"
    echo -e "  Duration: Using staged configuration from the script"
    echo -e "  Output: ${OUTPUT_FILE}"
    echo -e "\n${YELLOW}Starting test...${NC}\n"
    k6 run --out json=${OUTPUT_FILE} ${TEST_FILE}
else
    echo -e "  Test file: ${TEST_FILE}"
    echo -e "  Duration: ${DURATION}"
    echo -e "  Virtual Users: ${VUS}"
    echo -e "  Output: ${OUTPUT_FILE}"
    echo -e "\n${YELLOW}Starting test...${NC}\n"
    k6 run --vus ${VUS} --duration ${DURATION} --out json=${OUTPUT_FILE} ${TEST_FILE}
fi

# Check if the test completed successfully
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Test completed successfully!${NC}"
    echo -e "Results saved to: ${OUTPUT_FILE}"
    
    # Ask if the user wants to analyze the results
    echo -e "\n${YELLOW}Would you like to analyze the results? (y/n)${NC}"
    read -r ANALYZE
    
    if [[ $ANALYZE =~ ^[Yy]$ ]]; then
        if ! command -v node &> /dev/null; then
            echo -e "${YELLOW}Node.js is required to analyze results but is not installed.${NC}"
            echo -e "Please install Node.js to use the analysis script."
        else
            echo -e "\n${BLUE}Analyzing test results...${NC}\n"
            node analyze-results.js ${OUTPUT_FILE}
        fi
    fi
else
    echo -e "\n${YELLOW}Test did not complete successfully.${NC}"
fi

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${BLUE}             Test Complete              ${NC}"
echo -e "${BLUE}=========================================${NC}"
