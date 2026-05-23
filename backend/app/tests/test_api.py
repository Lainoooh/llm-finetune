from fastapi.testclient import TestClient

from app.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_servers_seeded():
    client = TestClient(app)
    response = client.get("/api/servers")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    assert "storageId" not in data["items"][0]
    assert data["items"][0]["id"].startswith("srv-")
    assert data["items"][0]["accessType"] in {"jupyter", "ssh"}


def test_create_ssh_server_round_trip():
    client = TestClient(app)
    created = client.post(
        "/api/servers",
        json={
            "name": "pytest-ssh-server",
            "accessType": "ssh",
            "host": "127.0.0.1",
            "user": "root",
            "password": "secret",
            "sshPort": 2222,
            "workDir": "/tmp",
            "gpuIds": "0",
        },
    )
    assert created.status_code == 200
    server = created.json()
    assert server["accessType"] == "ssh"
    assert server["sshPort"] == 2222
    assert "storageId" not in server

    deleted = client.delete(f"/api/servers/{server['id']}")
    assert deleted.status_code == 200


def test_tasks_and_subtasks_are_api_backed():
    client = TestClient(app)
    response = client.get("/api/tasks")
    assert response.status_code == 200
    tasks = response.json()["items"]
    assert tasks
    task = tasks[0]
    assert "storageId" not in task
    assert task["taskCode"].startswith("task-")

    response = client.get(f"/api/tasks/{task['taskCode']}/subtasks")
    assert response.status_code == 200
    subtasks = response.json()["items"]
    assert subtasks
    assert "storageId" not in subtasks[0]
    assert subtasks[0]["subtaskCode"].startswith("subtask-")


def test_task_crud_round_trip():
    client = TestClient(app)
    created = client.post(
        "/api/tasks",
        json={"name": "pytest_task", "modelName": "pytest_model", "baseModel": "Qwen/Test"},
    )
    assert created.status_code == 200
    task = created.json()

    patched = client.patch(f"/api/tasks/{task['taskCode']}", json={"description": "updated"})
    assert patched.status_code == 200
    assert patched.json()["description"] == "updated"

    deleted = client.delete(f"/api/tasks/{task['taskCode']}")
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True


def test_script_render_and_metrics():
    client = TestClient(app)
    rendered = client.post(
        "/api/scripts/server.probe_env/render",
        json={"params": {"work_dir": "/tmp", "gpu_ids": "0"}},
    )
    assert rendered.status_code == 200
    assert "/tmp" in rendered.json()["rendered"]

    metrics = client.get("/api/metrics/loss")
    assert metrics.status_code == 200
    assert metrics.json()["series"]
