#paste these into vscode's replace boxes, given a list of filenames, to get commands to fix up whatsapp videos.photos that have their date set to 0

# for photos:

IMG-(\d{4})(\d\d)(\d\d)-.+[.]jpg
exiftool -DateTimeOriginal="$1:$2:$3 12:00:00" $0

-DateTimeOriginal="2016:04:23 07:57:44"

# for videos:

VID-(\d{4})(\d\d)(\d\d)-.+[.]mp4
exiftool -QuickTime:CreateDate="$1:$2:$3 12:00:00" -QuickTime:ModifyDate="$1:$2:$3 12:00:00" -*MediaCreateDate="$1:$2:$3 12:00:00" -*MediaModifyDate="$1:$2:$3 12:00:00" -*TrackCreateDate="$1:$2:$3 12:00:00" -*TrackModifyDate="$1:$2:$3 12:00:00" $0

# Given a list of dates and filenames (on seperate lines) pulled from the amazon photos api, the following will give you the command

(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)[.]\d\d\dZ\n(.+[.]jpe?g)
exiftool -DateTimeOriginal="$1:$2:$3 $4:$5:$6" "$7"
