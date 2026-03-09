<?php
// backend/employees.php
require_once 'config.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        $where = '';
        $params = [];

        if ($id) {
            $where = 'WHERE e.id = ?';
            $params = [$id];
        } elseif (!empty($_GET['dept'])) {
            $where = 'WHERE d.name = ?';
            $params = [$_GET['dept']];
        } elseif (!empty($_GET['search'])) {
            $where = 'WHERE e.name LIKE ?';
            $params = ['%' . $_GET['search'] . '%'];
        }

        $sql = "SELECT e.id, e.emp_code, e.name, d.name AS department,
                       s.name AS section, e.email, e.phone, e.join_date, e.status
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN sections    s ON e.section_id    = s.id
                $where
                ORDER BY e.emp_code + 0";

        $stmt = $db->prepare($sql);
        if (!empty($params)) {
            $types = str_repeat('s', count($params));
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'data' => $result]);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("INSERT INTO employees (emp_code, name, department_id, section_id, email, phone, join_date) VALUES (?,?,?,?,?,?,?)");
        $stmt->bind_param('ssiiiss',
            $body['emp_code'], $body['name'],
            $body['department_id'], $body['section_id'],
            $body['email'], $body['phone'], $body['join_date']
        );
        $stmt->execute();
        echo json_encode(['success' => true, 'id' => $db->insert_id]);
        break;

    case 'PUT':
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("UPDATE employees SET name=?, department_id=?, section_id=?, email=?, phone=?, status=? WHERE id=?");
        $stmt->bind_param('siisssi',
            $body['name'], $body['department_id'], $body['section_id'],
            $body['email'], $body['phone'], $body['status'], $id
        );
        $stmt->execute();
        echo json_encode(['success' => true, 'affected' => $stmt->affected_rows]);
        break;

    case 'DELETE':
        $stmt = $db->prepare("UPDATE employees SET status='inactive' WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;
}

$db->close();
