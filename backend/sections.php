<?php
// backend/sections.php
require_once 'config.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        $sql = "SELECT s.id, s.name, d.name AS department, s.description
                FROM sections s JOIN departments d ON s.department_id = d.id
                ORDER BY s.id";
        $result = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'data' => $result]);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("INSERT INTO sections (name, department_id, description) VALUES (?,?,?)");
        $stmt->bind_param('sis', $body['name'], $body['department_id'], $body['description']);
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $db->insert_id]);
        break;

    case 'DELETE':
        $stmt = $db->prepare("DELETE FROM sections WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;
}

$db->close();
