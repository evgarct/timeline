PROJECT := Form.xcodeproj
SCHEME := Form
XCODEGEN ?= $(if $(wildcard $(HOME)/.local/bin/xcodegen),$(HOME)/.local/bin/xcodegen,xcodegen)
DESTINATION ?= platform=iOS Simulator,name=iPhone 17 Pro

ifneq ($(wildcard /Applications/Xcode.app/Contents/Developer),)
export DEVELOPER_DIR ?= /Applications/Xcode.app/Contents/Developer
endif

.PHONY: project build-ios test-ios ui-test-ios destinations clean

project:
	$(XCODEGEN) generate

build-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO build

test-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO test -only-testing:FormTests

ui-test-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO test -only-testing:FormUITests

destinations: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -showdestinations

clean: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) clean
