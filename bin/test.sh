#!/bin/bash
 
set -e
 
sleep 45 # to make sure tabookey-gasless is up and running before compiling
rm -rf build
truffle compile
truffle migrate --reset --network development
truffle test
kill -9 $(lsof -t -i:8545)
