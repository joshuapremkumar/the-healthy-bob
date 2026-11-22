.PHONY: demo demo-hi demo-es test api help

help:
	@echo "Targets: demo, demo-hi, demo-es, test, api"

demo:
	python -m bob_agent.demo --language ta

demo-hi:
	python -m bob_agent.demo --language hi

demo-es:
	python -m bob_agent.demo --language es

test:
	python -m unittest discover -s tests -v

api:
	uvicorn api.app:app --reload
