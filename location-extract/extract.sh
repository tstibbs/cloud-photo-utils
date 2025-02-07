#!/bin/bash

set -euxo pipefail

if [[ $# -ne 2 ]]
then
    echo "Usage: extract.sh dir outputfile"
	exit 1
fi

dir=$1
outputFile=$2

cd $dir

exiftool -filename -directory -gpslatitude -gpslongitude -ext JPG -ext JPEG -table --printConv -recurse "." | { grep -v -P '\t\-\t\-$' || [[ $? == 1 ]]; } | awk -F '\t' '{ print $2 "/" $1 "," $3 "," $4 }' > "../$outputFile"
