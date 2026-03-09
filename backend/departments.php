<?php
// backend/departments.php
require_once 'config.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        $result = $db->query("SELECT * FROM departments ORDER BY id")->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'data' => $result]);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("INSERT INTO departments (name, description) VALUES (?,?)");
        $stmt->bind_param('ss', $body['name'], $body['description']);
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $db->insert_id]);
        break;

    case 'DELETE':
        $stmt = $db->prepare("DELETE FROM departments WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;
}

$db->close();
