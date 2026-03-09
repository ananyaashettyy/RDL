<?php
require_once __DIR__ . '/config.php';

$UPLOADS_DIR = 'C:\\Users\\DELL\\Desktop\\attendance-system\\uploads';
$PARSER_SCRIPT = 'C:\\Users\\DELL\\Desktop\\attendance-system\\scripts\\parse_attlog_reports.py';
$NAME_RE = '/^(January|February|March|April|May|June|July|August|September|October|November|December)_\d{4}\.(xls|xlsx)$/';

function json_out($status, $payload) {
    http_response_code($status);
    echo json_encode($payload);
    exit();
}

function valid_filename($name, $regex) {
    return is_string($name) && preg_match($regex, $name) === 1;
}

if (!is_dir($UPLOADS_DIR) && !mkdir($UPLOADS_DIR, 0777, true)) {
    json_out(500, ['error' => 'Unable to create uploads directory']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $filename = $_GET['filename'] ?? '';
    if (!valid_filename($filename, $NAME_RE)) {
        json_out(400, [
            'error' => 'Invalid filename format',
            'required' => 'Month_Year.xls or Month_Year.xlsx (e.g., December_2025.xlsx)',
            'month_rule' => 'Month name must start with capital letter and match full month name',
        ]);
    }
    $target = $UPLOADS_DIR . DIRECTORY_SEPARATOR . basename($filename);
    json_out(200, ['exists' => file_exists($target)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['error' => 'Method not allowed']);
}

if (!isset($_FILES['file'])) {
    json_out(400, ['error' => 'No file uploaded']);
}

$uploaded = $_FILES['file'];
if ($uploaded['error'] !== UPLOAD_ERR_OK) {
    json_out(400, ['error' => 'Upload failed with error code: ' . $uploaded['error']]);
}

$originalName = basename($uploaded['name']);
if (!valid_filename($originalName, $NAME_RE)) {
    json_out(400, [
        'error' => 'Invalid filename format',
        'required' => 'Month_Year.xls or Month_Year.xlsx (e.g., December_2025.xlsx)',
        'month_rule' => 'Month name must start with capital letter and match full month name',
    ]);
}

$target = $UPLOADS_DIR . DIRECTORY_SEPARATOR . $originalName;
$exists = file_exists($target);
$overwrite = isset($_POST['overwrite']) && in_array(strtolower((string)$_POST['overwrite']), ['1', 'true', 'yes'], true);

if ($exists && !$overwrite) {
    json_out(409, ['error' => 'File already exists', 'exists' => true]);
}

if (!move_uploaded_file($uploaded['tmp_name'], $target)) {
    json_out(500, ['error' => 'Failed to move uploaded file into uploads directory']);
}

$cmd = 'python ' . escapeshellarg($PARSER_SCRIPT) . ' 2>&1';
$output = [];
$exitCode = 0;
exec($cmd, $output, $exitCode);

if ($exitCode !== 0) {
    json_out(500, [
        'error' => 'File uploaded but parser failed',
        'parser_output' => implode("\n", $output),
    ]);
}

json_out(200, [
    'message' => 'File uploaded and attendance data regenerated successfully',
    'overwrote' => $exists,
    'saved_to' => $target,
    'parser_output' => implode("\n", $output),
]);
